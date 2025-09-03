import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { taskStatus } from '@/lib/taskStatus'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const task = taskStatus.get(taskId)
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const excelFile = task.excel_file
    
    if (!excelFile) {
      return NextResponse.json({ error: 'Excel file not found' }, { status: 404 })
    }

    const filePath = path.join(process.cwd(), 'uploads', excelFile)
    
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File does not exist' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)
    
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${excelFile}"`,
        'Content-Length': fileBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: '下载失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}