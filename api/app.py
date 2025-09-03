import os
import sys
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, send_file
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
import threading
import time
import pandas as pd

# 导入原有的分析函数
from prompt_generate import analyze_single_image, translate_to_english, DEFAULT_MODELS

# 设置与原始文件相同的环境变量和配置
os.environ["OPENAI_API_KEY"] = "35f54cc4-be7a-4414-808e-f5f9f0194d4f"
os.environ["OPENAI_API_BASE"] = "http://gpt-proxy.jd.com/v1"

# 默认分析提示词（与原始文件保持一致）
DEFAULT_PROMPT = "请分析这张图片的设计特点、视觉效果和用户体验要素。"

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # 用于flash消息

# 配置
UPLOAD_FOLDER = 'uploads'
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 存储分析任务的状态
task_status = {}

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def cleanup_old_files():
    """清理旧的上传文件（超过1小时的文件）"""
    try:
        current_time = time.time()
        for filename in os.listdir(UPLOAD_FOLDER):
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.isfile(file_path):
                file_age = current_time - os.path.getctime(file_path)
                if file_age > 3600:  # 1小时
                    os.remove(file_path)
                    print(f"已清理旧文件: {filename}")
    except Exception as e:
        print(f"清理文件时出错: {str(e)}")

def analyze_images_async(files_info, task_id, custom_prompt, selected_models=None):
    """异步分析多张图片并生成Excel"""
    try:
        # 更新状态为处理中
        task_status[task_id]['status'] = 'processing'
        task_status[task_id]['progress'] = 0
        
        results = []
        total_files = len(files_info)
        
        # 逐个分析图片
        for i, file_info in enumerate(files_info):
            try:
                print(f"正在分析图片: {file_info['filename']}")
                # analyze_single_image返回的是model_analysis_pairs列表
                # 如果没有自定义提示词，使用默认提示词
                prompt_to_use = custom_prompt if custom_prompt else DEFAULT_PROMPT
                # 如果没有指定模型，使用默认的所有模型
                models_to_use = selected_models if selected_models else DEFAULT_MODELS
                model_analysis_pairs = analyze_single_image(file_info['filepath'], prompt_to_use, models_to_use)
                
                if model_analysis_pairs and len(model_analysis_pairs) > 0:
                    # 保留所有模型的分析结果
                    for model_name, analysis_content in model_analysis_pairs:
                        if analysis_content and not analysis_content.startswith("分析失败"):
                            # 翻译为英文
                            english_result = translate_to_english(analysis_content)
                            
                            result = {
                                'filename': file_info['filename'],
                                'original_filename': file_info['original_name'],
                                'model': model_name,
                                'analysis': analysis_content,
                                'english_analysis': english_result
                            }
                            results.append(result)
                            # 移除break，保留所有成功的模型结果
                
                # 更新进度
                task_status[task_id]['progress'] = i + 1
                task_status[task_id]['results'] = results
                
            except Exception as e:
                print(f"分析图片 {file_info['original_name']} 时出错: {str(e)}")
                continue
        
        if results:
            # 生成Excel文件
            excel_filename = f"analysis_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            excel_path = os.path.join(app.config['UPLOAD_FOLDER'], excel_filename)
            
            # 创建Excel数据
            excel_data = []
            for result in results:
                excel_data.append({
                    '图片名': result.get('original_filename', result.get('filename', '')),
                    '模型名': result.get('model', ''),
                    '分析内容': result.get('analysis', ''),
                    '英文prompt': result.get('english_analysis', '')
                })
            
            # 保存为Excel
            df = pd.DataFrame(excel_data)
            with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='分析结果')
                
                # 设置列宽
                worksheet = writer.sheets['分析结果']
                worksheet.column_dimensions['A'].width = 30
                worksheet.column_dimensions['B'].width = 15
                worksheet.column_dimensions['C'].width = 50
                worksheet.column_dimensions['D'].width = 50
            
            task_status[task_id]['excel_file'] = excel_filename
            task_status[task_id]['status'] = 'completed'
        else:
            task_status[task_id]['error'] = '所有图片分析失败'
            task_status[task_id]['status'] = 'failed'
    
    except Exception as e:
        task_status[task_id]['error'] = str(e)
        task_status[task_id]['status'] = 'failed'
    
    finally:
        # 清理上传的文件
        for file_info in files_info:
            try:
                if os.path.exists(file_info['filepath']):
                    os.remove(file_info['filepath'])
            except:
                pass

@app.route('/')
def index():
    """主页 - 显示上传界面"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """处理文件上传"""
    try:
        if 'files' not in request.files:
            flash('没有选择文件', 'error')
            return redirect(url_for('index'))
        
        files = request.files.getlist('files')
        if not files or all(f.filename == '' for f in files):
            flash('没有选择文件', 'error')
            return redirect(url_for('index'))
        
        # 过滤有效文件
        valid_files = [f for f in files if f and f.filename != '' and allowed_file(f.filename)]
        
        if not valid_files:
            flash('没有有效的图片文件', 'error')
            return redirect(url_for('index'))
        
        if len(valid_files) > 10:
            flash('最多只能同时上传10张图片', 'error')
            return redirect(url_for('index'))
        
        # 检查文件大小
        for file in valid_files:
            file.seek(0, 2)
            file_size = file.tell()
            file.seek(0)
            
            if file_size > app.config['MAX_CONTENT_LENGTH']:
                flash(f'文件 "{file.filename}" 太大，请选择小于16MB的文件', 'error')
                return redirect(url_for('index'))
        
        # 清理旧文件
        cleanup_old_files()
        
        # 保存所有文件
        saved_files = []
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        for i, file in enumerate(valid_files):
            filename = secure_filename(file.filename)
            filename = f"{timestamp}_{i+1:02d}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            saved_files.append({
                'filepath': filepath,
                'filename': filename,
                'original_name': file.filename
            })
        
        # 获取自定义提示词
        custom_prompt = request.form.get('prompt', '').strip()
        
        # 获取用户选择的模型列表
        selected_models = request.form.getlist('models')
        if not selected_models:
            # 如果没有选择任何模型，使用默认的所有模型
            selected_models = DEFAULT_MODELS
        
        # 生成任务ID
        task_id = str(uuid.uuid4())
        
        # 初始化任务状态
        task_status[task_id] = {
            'status': 'processing',
            'progress': 0,
            'total': len(saved_files),
            'results': [],
            'error': None,
            'start_time': datetime.now(),
            'files': saved_files,
            'excel_file': None,
            'selected_models': selected_models
        }
        
        # 启动异步分析任务
        thread = threading.Thread(
            target=analyze_images_async, 
            args=(saved_files, task_id, custom_prompt, selected_models)
        )
        thread.daemon = True
        thread.start()
        
        return redirect(url_for('result', task_id=task_id))
    
    except Exception as e:
        flash(f'上传失败: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/result/<task_id>')
def result(task_id):
    """显示分析结果"""
    if task_id not in task_status:
        flash('任务不存在')
        return redirect(url_for('index'))
    
    task = task_status[task_id]
    return render_template('result.html', task=task, task_id=task_id)

@app.route('/api/status/<task_id>')
def get_status(task_id):
    """获取任务状态的API接口"""
    if task_id not in task_status:
        return jsonify({'error': 'Task not found'}), 404
    
    task = task_status[task_id]
    return jsonify({
        'status': task['status'],
        'progress': task.get('progress', 0),
        'total': task.get('total', 0),
        'results': task.get('results', []),
        'error': task.get('error', ''),
        'excel_file': task.get('excel_file', '')
    })

@app.route('/download/<task_id>')
def download_excel(task_id):
    """下载Excel文件"""
    if task_id not in task_status:
        flash('任务不存在', 'error')
        return redirect(url_for('index'))
    
    task = task_status[task_id]
    excel_file = task.get('excel_file')
    
    if not excel_file:
        flash('Excel文件不存在', 'error')
        return redirect(url_for('result', task_id=task_id))
    
    excel_path = os.path.join(app.config['UPLOAD_FOLDER'], excel_file)
    
    if not os.path.exists(excel_path):
        flash('Excel文件已被删除', 'error')
        return redirect(url_for('result', task_id=task_id))
    
    try:
        return send_file(
            excel_path,
            as_attachment=True,
            download_name=excel_file,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        flash(f'下载失败: {str(e)}', 'error')
        return redirect(url_for('result', task_id=task_id))

@app.route('/cleanup')
def cleanup():
    """手动清理旧文件"""
    cleanup_old_files()
    flash('已清理旧文件')
    return redirect(url_for('index'))

@app.errorhandler(413)
def too_large(e):
    flash('文件太大。请上传小于16MB的文件。')
    return redirect(url_for('index'))

if __name__ == '__main__':
    # 启动时清理旧文件
    cleanup_old_files()
    
    print("="*60)
    print("图片分析Web应用启动中...")
    print("="*60)
    print("访问地址:")
    print("  本地访问: http://localhost:5000")
    print("  局域网访问: http://[你的IP地址]:5000")
    print("="*60)
    
    # 启动Flask应用，允许局域网访问
    app.run(host='0.0.0.0', port=5000, debug=True)