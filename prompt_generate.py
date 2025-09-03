import os
import sys
import pandas as pd
import PyPDF2
import glob
from PIL import Image
import warnings
from datetime import datetime
try:
    import openpyxl
except ImportError:
    print("警告: 未安装openpyxl库，Excel功能可能无法正常使用。请运行: pip install openpyxl")

warnings.filterwarnings("ignore")

# 配置路径
BASE_DIR = r'D:\code\data\主图优化1期\1期-select\9756'
OPENIMG_DIR = BASE_DIR  # 目标图片文件夹
DEFAULT_OUTPUT_FILE = os.path.join(BASE_DIR, "result_with_english.xlsx")  # 默认输出文件

# 设置OpenAI API密钥和基础URL
os.environ["OPENAI_API_KEY"] = "35f54cc4-be7a-4414-808e-f5f9f0194d4f"
os.environ["OPENAI_API_BASE"] = "http://gpt-proxy.jd.com/v1"

# 默认分析提示词
DEFAULT_PROMPT = "请分析这张图片的设计特点、视觉效果和用户体验要素。"

# 默认使用的模型列表
DEFAULT_MODELS = [
    "gpt-4o-0806",
    "anthropic.claude-sonnet-4-20250514-v1:0",
    "gpt-4.1",
    "Doubao-1.5-vision-pro-32k",
    "claude-3-7-sonnet-v1"
]

def translate_to_english(chinese_text):
    """
    将中文文本翻译为英文
    
    Args:
        chinese_text: 需要翻译的中文文本
    
    Returns:
        str: 翻译后的英文文本
    """
    try:
        from openai import OpenAI
        
        # 初始化OpenAI客户端
        client = OpenAI(
            api_key=os.environ["OPENAI_API_KEY"],
            base_url=os.environ["OPENAI_API_BASE"]
        )
        
        # 使用GPT进行翻译
        response = client.chat.completions.create(
            model="gpt-4o-0806",  # 使用稳定的模型进行翻译
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional translator. Please translate the following Chinese text to English. Keep the meaning accurate and the language natural. Only return the translated text without any additional explanation."
                },
                {
                    "role": "user",
                    "content": chinese_text
                }
            ],
            temperature=0.3,
            max_tokens=2000
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"  翻译失败: {str(e)}")
        return f"Translation failed: {str(e)}"

def read_pdf(pdf_path):
    """读取PDF文件内容"""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
    except Exception as e:
        print(f"读取PDF文件时出错：{str(e)}")
        return ""

def get_image_files(image_dir):
    """获取指定目录下的所有图片文件"""
    if not os.path.exists(image_dir):
        print(f"警告: 图片目录 {image_dir} 不存在")
        return []
    
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.gif', '*.tiff']
    image_files = []
    
    for ext in image_extensions:
        image_files.extend(glob.glob(os.path.join(image_dir, ext)))
        image_files.extend(glob.glob(os.path.join(image_dir, ext.upper())))
    
    # 去除重复文件（因为大小写扩展名可能匹配同一文件）
    image_files = list(set(image_files))
    
    return sorted(image_files)

def analyze_single_image(image_path, prompt=None, models=None):
    """
    使用多个模型分析单个图片
    
    Args:
        image_path: 图片路径
        prompt: 分析提示词，如果为None则使用默认提示词
        models: 要使用的模型列表，如果为None则使用默认模型列表
    
    Returns:
        tuple: (最佳模型名称, 分析结果)
    """
    if prompt is None:
        prompt = DEFAULT_PROMPT
    
    if models is None:
        models = DEFAULT_MODELS  # 使用默认模型列表
    
    print(f"正在分析图片: {os.path.basename(image_path)}")
    
    # 获取图片信息
    try:
        img = Image.open(image_path)
        image_info = f"图片路径: {image_path}\n图片尺寸: {img.size}\n图片格式: {img.format}"
    except Exception as e:
        image_info = f"图片路径: {image_path}\n无法读取图片信息: {str(e)}"
    
    # 构建完整提示词
    full_prompt = f"{prompt}\n\n图片信息:\n{image_info}"
    
    # 将图片转换为base64编码
    import base64
    try:
        with open(image_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        return "编码失败", f"图片base64编码失败: {str(e)}"
    
    try:
        # 使用新版本OpenAI库（1.0+）
        from openai import OpenAI
        
        # 初始化OpenAI客户端
        client = OpenAI(
            api_key=os.environ["OPENAI_API_KEY"],
            base_url=os.environ["OPENAI_API_BASE"]
        )
        
        from collections import Counter
        model_results = []
        analysis_results = []
        
        # 使用每个模型进行分析
        for model in models:
            try:
                print(f"  使用模型 {model} 分析中...")
                
                # 新版本API调用 - 包含图片数据
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {
                            "role": "system",
                            "content": prompt if prompt else DEFAULT_PROMPT
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                            ]
                        }
                    ],
                    temperature=0.5,
                    max_tokens=1000
                )
                
                # 添加更强的错误处理
                if response and hasattr(response, 'choices') and response.choices and len(response.choices) > 0:
                    if hasattr(response.choices[0], 'message') and hasattr(response.choices[0].message, 'content'):
                        result = response.choices[0].message.content
                        if result:
                            model_results.append(model)
                            analysis_results.append(f"[{model}分析结果]\n{result}")
                            print(f"  模型 {model} 分析完成")
                        else:
                            print(f"  模型 {model} 返回空结果")
                            analysis_results.append(f"[{model}分析结果]\n分析失败: 模型返回空结果")
                    else:
                        print(f"  模型 {model} 响应格式异常")
                        analysis_results.append(f"[{model}分析结果]\n分析失败: 响应格式异常")
                else:
                    print(f"  模型 {model} 响应为空或无choices")
                    analysis_results.append(f"[{model}分析结果]\n分析失败: 响应为空或无choices")

            except Exception as e:
                print(f"  模型 {model} 分析失败: {str(e)}")
                analysis_results.append(f"[{model}分析结果]\n分析失败: {str(e)}")

        
        # 返回每个模型的独立结果
        model_analysis_pairs = []
        for i, model in enumerate(models):
            if i < len(analysis_results):
                # 提取纯净的分析结果（去掉模型名称前缀）
                result_text = analysis_results[i]
                if result_text.startswith(f"[{model}分析结果]\n"):
                    clean_result = result_text[len(f"[{model}分析结果]\n"):]
                else:
                    clean_result = result_text
                model_analysis_pairs.append((model, clean_result))
        
        if model_analysis_pairs:
            return model_analysis_pairs
        else:
            return [("分析失败", "所有模型都无法完成分析")]
            
    except Exception as e:
        error_msg = f"分析过程中出现错误: {str(e)}"
        print(f"  {error_msg}")
        return [("分析失败", error_msg)]

def analyze_images_to_excel(image_dir=None, prompt=None, output_file=None, models=None):
    """
    分析指定目录下的所有图片并将结果保存到Excel文件
    
    Args:
        image_dir: 图片目录路径，默认使用OPENIMG_DIR
        prompt: 分析提示词，默认使用DEFAULT_PROMPT
        output_file: 输出Excel文件路径，默认保存到BASE_DIR
        models: 要使用的模型列表，默认使用预设模型
    
    Returns:
        str: 输出文件路径
    """
    # 设置默认参数
    if image_dir is None:
        image_dir = OPENIMG_DIR
    if prompt is None:
        prompt = DEFAULT_PROMPT
    if output_file is None:
        output_file = DEFAULT_OUTPUT_FILE
    if models is None:
        models = DEFAULT_MODELS  # 使用默认模型列表
    
    print("="*60)
    print("图片批量分析程序")
    print("="*60)
    print(f"图片目录: {image_dir}")
    print(f"分析提示词: {prompt}")
    print(f"使用模型: {', '.join(models)}")
    print(f"输出文件: {output_file}")
    print("="*60)
    
    # 获取所有图片文件
    image_files = get_image_files(image_dir)
    
    if not image_files:
        print("未找到任何图片文件，程序退出。")
        return None
    
    print(f"找到 {len(image_files)} 个图片文件，开始分析...\n")
    
    # 准备结果数据
    results = []
    
    # 逐个分析图片
    for i, image_path in enumerate(image_files, 1):
        print(f"[{i}/{len(image_files)}] 分析图片: {os.path.basename(image_path)}")
        
        try:
            # 分析图片
            model_analysis_pairs = analyze_single_image(image_path, prompt, models)
            
            # 为每个模型的分析结果创建独立的行
            for model_name, analysis_result in model_analysis_pairs:
                print(f"    正在翻译 {model_name} 的分析结果...")
                english_translation = translate_to_english(analysis_result)
                
                results.append({
                    '图片名': os.path.basename(image_path),
                    '模型名': model_name,
                    '分析内容': analysis_result,
                    '英文prompt': english_translation
                })
            
            print(f"  分析完成，共使用 {len(model_analysis_pairs)} 个模型\n")
            
        except Exception as e:
            error_msg = f"分析失败: {str(e)}"
            print(f"  {error_msg}\n")
            
            results.append({
                '图片名': os.path.basename(image_path),
                '模型名': '分析失败',
                '分析内容': error_msg,
                '英文prompt': 'Analysis failed'
            })
    
    # 保存结果到Excel
    try:
        df = pd.DataFrame(results)
        
        # 确保输出目录存在
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # 保存到Excel文件
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='图片分析结果', index=False)
            
            # 调整列宽
            worksheet = writer.sheets['图片分析结果']
            worksheet.column_dimensions['A'].width = 30  # 图片名列
            worksheet.column_dimensions['B'].width = 20  # 模型名列
            worksheet.column_dimensions['C'].width = 80  # 分析内容列
            worksheet.column_dimensions['D'].width = 80  # 英文prompt列
        
        print("="*60)
        print(f"分析完成！结果已保存到: {output_file}")
        print(f"共分析 {len(image_files)} 个图片")
        print(f"成功分析 {len([r for r in results if r['模型名'] != '分析失败'])} 个")
        print(f"分析失败 {len([r for r in results if r['模型名'] == '分析失败'])} 个")
        print("="*60)
        
        return output_file
        
    except Exception as e:
        error_msg = f"保存Excel文件时出错: {str(e)}"
        print(error_msg)
        return None

def main():
    """
    主函数 - 可以通过命令行参数或直接调用
    
    命令行参数:
        python prompt_generate.py [图片目录] [分析提示词] [输出文件]
    """
    # 解析命令行参数
    image_dir = OPENIMG_DIR
    prompt = DEFAULT_PROMPT
    output_file = None
    
    if len(sys.argv) > 1:
        image_dir = sys.argv[1]
    if len(sys.argv) > 2:
        prompt = sys.argv[2]
    if len(sys.argv) > 3:
        output_file = sys.argv[3]
    
    # 执行分析
    result_file = analyze_images_to_excel(
        image_dir=image_dir,
        prompt=prompt,
        output_file=output_file
    )
    
    return result_file

if __name__ == "__main__":
    main()