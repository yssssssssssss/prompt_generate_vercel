import { NextRequest, NextResponse } from 'next/server'
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

    return NextResponse.json({
      status: task.status,
      progress: task.progress || 0,
      total: task.total || 0,
      results: task.results || [],
      error: task.error || '',
      excel_file: task.excel_file || ''
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: '获取状态失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}