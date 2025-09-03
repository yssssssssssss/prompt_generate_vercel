import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { analyzeImagesAsync } from '@/lib/imageAnalysis'

// 存储任务状态的内存对象
const taskStatus = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const prompt = formData.get('prompt') as string
    const models = formData.getAll('models') as string[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '没有上传文件' }, { status: 400 })
    }

    if (files.length > 10) {
      return NextResponse.json({ error: '最多只能上传10张图片' }, { status: 400 })
    }

    // 验证文件类型和大小
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/bmp', 'image/tiff']
    const maxSize = 16 * 1024 * 1024 // 16MB

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `不支持的文件类型: ${file.type}` }, { status: 400 })
      }
      if (file.size > maxSize) {
        return NextResponse.json({ error: `文件 ${file.name} 太大，请选择小于16MB的文件` }, { status: 400 })
      }
    }

    // 创建上传目录
    const uploadDir = path.join(process.cwd(), 'uploads')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 保存文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const savedFiles = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      const filename = `${timestamp}_${i + 1:02d}_${file.name}`
      const filepath = path.join(uploadDir, filename)
      
      await writeFile(filepath, buffer)
      
      savedFiles.push({
        filepath,
        filename,
        original_name: file.name
      })
    }

    // 生成任务ID
    const taskId = uuidv4()

    // 初始化任务状态
    taskStatus.set(taskId, {
      status: 'processing',
      progress: 0,
      total: savedFiles.length,
      results: [],
      error: null,
      start_time: new Date(),
      files: savedFiles,
      excel_file: null,
      selected_models: models.length > 0 ? models : [
        'gpt-4o-0806',
        'anthropic.claude-sonnet-4-20250514-v1:0',
        'gpt-4.1',
        'Doubao-1.5-vision-pro-32k',
        'claude-3-7-sonnet-v1'
      ]
    })

    // 启动异步分析任务
    analyzeImagesAsync(savedFiles, taskId, prompt, taskStatus)
      .catch(error => {
        console.error('Analysis error:', error)
        const task = taskStatus.get(taskId)
        if (task) {
          task.status = 'failed'
          task.error = error.message
        }
      })

    return NextResponse.json({ taskId })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: '上传失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

// 导出任务状态供其他API使用
export { taskStatus }