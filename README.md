# 图片批量分析工具

这个工具可以批量分析文件夹中的所有图片，使用多个AI模型进行分析，并将结果保存到Excel文件中。

## 功能特点

- 支持多种图片格式：JPG, JPEG, PNG, BMP, GIF, TIFF
- 使用多个AI模型进行分析：gpt-4o-0806, DeepSeek-R1-zijie, claude-3-7-sonnet-v1
- 自动生成带时间戳的Excel报告
- 支持自定义分析提示词
- 详细的分析进度显示

## 安装依赖

```bash
pip install pandas openpyxl pillow PyPDF2 openai
```

## 使用方法

### 1. 直接运行（使用默认设置）

```bash
python prompt_generate.py
```

这将使用默认的图片目录和分析提示词。

### 2. 指定图片目录

```bash
python prompt_generate.py "C:/path/to/your/images"
```

### 3. 指定图片目录和自定义提示词

```bash
python prompt_generate.py "C:/path/to/your/images" "请分析这张图片的色彩搭配和构图特点"
```

### 4. 完整参数

```bash
python prompt_generate.py "C:/path/to/your/images" "分析提示词" "C:/path/to/output.xlsx"
```

### 5. 在代码中调用

```python
from prompt_generate import analyze_images_to_excel

# 基本使用
result_file = analyze_images_to_excel(
    image_dir="C:/path/to/your/images",
    prompt="请分析这张图片的设计特点"
)

# 完整参数
result_file = analyze_images_to_excel(
    image_dir="C:/path/to/your/images",
    prompt="请分析这张图片的设计特点、视觉效果和用户体验要素",
    output_file="C:/path/to/output.xlsx",
    models=["gpt-4o-0806", "DeepSeek-R1-zijie"]
)
```

## 输出格式

Excel文件包含以下列：
- **图片名**：图片文件名
- **模型名**：使用的AI模型名称
- **分析内容**：详细的分析结果

## 配置说明

在代码中可以修改以下配置：

- `BASE_DIR`：基础目录路径
- `OPENIMG_DIR`：默认图片目录
- `DEFAULT_PROMPT`：默认分析提示词
- OpenAI API配置

## 注意事项

1. 确保已正确配置OpenAI API密钥和基础URL
2. 图片文件较多时，分析过程可能需要较长时间
3. 网络连接问题可能导致某些图片分析失败
4. 建议在分析大量图片前先测试少量图片

## 错误处理

- 如果图片无法读取，会在结果中标记为分析失败
- 如果AI模型调用失败，会记录错误信息
- 程序会继续处理其他图片，不会因单个错误而停止