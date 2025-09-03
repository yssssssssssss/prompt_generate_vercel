import OpenAI from 'openai'
import { readFile, unlink } from 'fs/promises'
import path from 'path'
import ExcelJS from 'exceljs'

// 默认分析提示词
const DEFAULT_PROMPT = "请分析这张图片的设计特点、视觉效果和用户体验要素。"

// 默认使用的模型列表
const DEFAULT_MODELS = [
  "gpt-4o-0806",
  "anthropic.claude-sonnet-4-20250514-v1:0",
  "gpt-4.1",
  "Doubao-1.5-vision-pro-32k",
  "claude-3-7-sonnet-v1"
]

interface FileInfo {
  filepath: string
  filename: string
  original_name: string
}

interface AnalysisResult {
  filename: string
  original_filename: string
  model: string
  analysis: string
  english_analysis: string
}

/**
 * 将中文文本翻译为英文
 */
async function translateToEnglish(chineseText: string): Promise<string> {
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE
    })

    const response = await client.chat.completions.create({
      model: "gpt-4o-0806",
      messages: [
        {
          role: "system",
          content: "You are a professional translator. Please translate the following Chinese text to English. Keep the meaning accurate and the language natural. Only return the translated text without any additional explanation."
        },
        {
          role: "user",
          content: chineseText
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })

    return response.choices[0]?.message?.content?.trim() || 'Translation failed'
  } catch (error) {
    console.error('Translation failed:', error)
    return `Translation failed: ${(error as Error).message}`
  }
}

/**
 * 使用多个模型分析单个图片
 */
async function analyzeSingleImage(
  imagePath: string,
  prompt: string = DEFAULT_PROMPT,
  models: string[] = DEFAULT_MODELS
): Promise<Array<[string, string]>> {
  console.log(`正在分析图片: ${path.basename(imagePath)}`)

  try {
    // 读取图片并转换为base64
    const imageBuffer = await readFile(imagePath)
    const base64Image = imageBuffer.toString('base64')

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE
    })

    const modelAnalysisPairs: Array<[string, string]> = []

    // 使用每个模型进行分析
    for (const model of models) {
      try {
        console.log(`  使用模型 ${model} 分析中...`)

        const response = await client.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: prompt
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          temperature: 0.5,
          max_tokens: 1000
        })

        const result = response.choices[0]?.message?.content
        if (result) {
          modelAnalysisPairs.push([model, result])
          console.log(`  模型 ${model} 分析完成`)
        } else {
          console.log(`  模型 ${model} 返回空结果`)
          modelAnalysisPairs.push([model, "分析失败: 模型返回空结果"])
        }
      } catch (error) {
        console.error(`  模型 ${model} 分析失败:`, error)
        modelAnalysisPairs.push([model, `分析失败: ${(error as Error).message}`])
      }
    }

    return modelAnalysisPairs.length > 0 ? modelAnalysisPairs : [['分析失败', '所有模型都无法完成分析']]
  } catch (error) {
    const errorMsg = `分析过程中出现错误: ${(error as Error).message}`
    console.error(errorMsg)
    return [['分析失败', errorMsg]]
  }
}

/**
 * 异步分析多张图片并生成Excel
 */
export async function analyzeImagesAsync(
  filesInfo: FileInfo[],
  taskId: string,
  customPrompt: string,
  taskStatus: Map<string, any>
): Promise<void> {
  try {
    const task = taskStatus.get(taskId)
    if (!task) throw new Error('Task not found')

    // 更新状态为处理中
    task.status = 'processing'
    task.progress = 0

    const results: AnalysisResult[] = []
    const totalFiles = filesInfo.length

    // 逐个分析图片
    for (let i = 0; i < filesInfo.length; i++) {
      const fileInfo = filesInfo[i]
      try {
        console.log(`正在分析图片: ${fileInfo.original_name}`)
        
        const promptToUse = customPrompt || DEFAULT_PROMPT
        const modelsToUse = task.selected_models || DEFAULT_MODELS
        
        const modelAnalysisPairs = await analyzeSingleImage(
          fileInfo.filepath,
          promptToUse,
          modelsToUse
        )

        if (modelAnalysisPairs && modelAnalysisPairs.length > 0) {
          for (const [modelName, analysisContent] of modelAnalysisPairs) {
            if (analysisContent && !analysisContent.startsWith("分析失败")) {
              // 翻译为英文
              const englishResult = await translateToEnglish(analysisContent)

              const result: AnalysisResult = {
                filename: fileInfo.filename,
                original_filename: fileInfo.original_name,
                model: modelName,
                analysis: analysisContent,
                english_analysis: englishResult
              }
              results.push(result)
            }
          }
        }

        // 更新进度
        task.progress = i + 1
        task.results = results
      } catch (error) {
        console.error(`分析图片 ${fileInfo.original_name} 时出错:`, error)
        continue
      }
    }

    if (results.length > 0) {
      // 生成Excel文件
      const excelFilename = `analysis_results_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`
      const excelPath = path.join(process.cwd(), 'uploads', excelFilename)

      await generateExcelFile(results, excelPath)

      task.excel_file = excelFilename
      task.status = 'completed'
    } else {
      task.error = '所有图片分析失败'
      task.status = 'failed'
    }
  } catch (error) {
    console.error('Analysis error:', error)
    const task = taskStatus.get(taskId)
    if (task) {
      task.error = (error as Error).message
      task.status = 'failed'
    }
  } finally {
    // 清理上传的文件
    for (const fileInfo of filesInfo) {
      try {
        await unlink(fileInfo.filepath)
      } catch (error) {
        console.error(`清理文件失败: ${fileInfo.filepath}`, error)
      }
    }
  }
}

/**
 * 生成Excel文件
 */
async function generateExcelFile(results: AnalysisResult[], filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('分析结果')

  // 设置列标题
  worksheet.columns = [
    { header: '图片名', key: 'filename', width: 30 },
    { header: '模型名', key: 'model', width: 20 },
    { header: '分析内容', key: 'analysis', width: 50 },
    { header: '英文prompt', key: 'english_analysis', width: 50 }
  ]

  // 添加数据
  results.forEach(result => {
    worksheet.addRow({
      filename: result.original_filename,
      model: result.model,
      analysis: result.analysis,
      english_analysis: result.english_analysis
    })
  })

  // 设置样式
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }

  // 保存文件
  await workbook.xlsx.writeFile(filePath)
  console.log(`Excel文件已生成: ${filePath}`)
}