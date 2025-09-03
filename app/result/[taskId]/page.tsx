'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Download, RefreshCw, ArrowLeft, CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react'

interface AnalysisResult {
  filename: string
  original_filename: string
  model: string
  analysis: string
  english_analysis: string
}

interface TaskStatus {
  status: 'processing' | 'completed' | 'failed'
  progress: number
  total: number
  results: AnalysisResult[]
  error?: string
  excel_file?: string
}

export default function ResultPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.taskId as string
  
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/status/${taskId}`)
      if (response.ok) {
        const data = await response.json()
        setTaskStatus(data)
        setError(null)
      } else {
        setError('获取任务状态失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!taskId) return
    
    fetchStatus()
    
    // 如果任务还在进行中，每2秒刷新一次状态
    const interval = setInterval(() => {
      if (taskStatus?.status === 'processing') {
        fetchStatus()
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [taskId, taskStatus?.status])

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/download/${taskId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = taskStatus?.excel_file || 'analysis_results.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('下载失败')
      }
    } catch (error) {
      alert('下载失败')
    }
  }

  const getStatusIcon = () => {
    if (!taskStatus) return <Clock className="w-5 h-5" />
    
    switch (taskStatus.status) {
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5" />
    }
  }

  const getStatusText = () => {
    if (!taskStatus) return '加载中...'
    
    switch (taskStatus.status) {
      case 'processing':
        return `分析中... (${taskStatus.progress}/${taskStatus.total})`
      case 'completed':
        return '分析完成'
      case 'failed':
        return '分析失败'
      default:
        return '未知状态'
    }
  }

  const getProgressPercentage = () => {
    if (!taskStatus || taskStatus.total === 0) return 0
    return Math.round((taskStatus.progress / taskStatus.total) * 100)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">加载任务状态中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-4">
            <button onClick={fetchStatus} className="btn-primary">
              <RefreshCw className="w-4 h-4 mr-2" />
              重试
            </button>
            <button onClick={() => router.push('/')} className="btn-secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 状态卡片 */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <h1 className="text-2xl font-bold text-gray-900">分析结果</h1>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={fetchStatus}
              className="btn-secondary"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button onClick={() => router.push('/')} className="btn-secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
            <span className="text-sm text-gray-500">{getProgressPercentage()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="progress-bar h-2 rounded-full transition-all duration-500"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>
        </div>
        
        {taskStatus?.status === 'failed' && taskStatus.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 font-medium">错误信息：</span>
            </div>
            <p className="text-red-600 mt-1">{taskStatus.error}</p>
          </div>
        )}
        
        {taskStatus?.status === 'completed' && taskStatus.excel_file && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-700 font-medium">分析完成！</span>
              </div>
              <button onClick={handleDownload} className="btn-primary">
                <Download className="w-4 h-4 mr-2" />
                下载Excel报告
              </button>
            </div>
            <p className="text-green-600 mt-1">所有图片分析完成，结果已生成Excel文件</p>
          </div>
        )}
      </div>

      {/* 分析结果 */}
      {taskStatus?.results && taskStatus.results.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center mb-6">
            <FileText className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold">分析结果</h2>
            <span className="ml-2 bg-primary-100 text-primary-800 text-sm font-medium px-2.5 py-0.5 rounded">
              {taskStatus.results.length} 条结果
            </span>
          </div>
          
          <div className="space-y-6">
            {taskStatus.results.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">{result.original_filename}</h3>
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {result.model}
                  </span>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">中文分析</h4>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-40 overflow-y-auto">
                      {result.analysis}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">英文翻译</h4>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-40 overflow-y-auto">
                      {result.english_analysis}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}