'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Image as ImageIcon, Settings, Sparkles } from 'lucide-react'

const DEFAULT_MODELS = [
  { id: 'gpt-4o-0806', name: 'GPT-4o-0806', description: 'OpenAI最新视觉模型' },
  { id: 'anthropic.claude-sonnet-4-20250514-v1:0', name: 'Claude Sonnet 4', description: 'Anthropic高性能模型' },
  { id: 'gpt-4.1', name: 'GPT-4.1', description: 'OpenAI增强版本' },
  { id: 'Doubao-1.5-vision-pro-32k', name: 'Doubao-1.5-vision-pro-32k', description: '字节跳动视觉模型' },
  { id: 'claude-3-7-sonnet-v1', name: 'Claude 3.7 Sonnet', description: 'Anthropic经典模型' }
]

const DEFAULT_PROMPT = "你是一个专业的图像分析专家。我给你的是商品主图，请忽略掉主图中的商品、贴片等元素，仅仅考虑背景，请详细描述图片背景的内容，不需要进行其他维度的解释。"

export default function HomePage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_MODELS.map(m => m.id))
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    
    const validFiles = Array.from(selectedFiles).filter(file => {
      const validTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/bmp', 'image/tiff']
      const maxSize = 16 * 1024 * 1024 // 16MB
      return validTypes.includes(file.type) && file.size <= maxSize
    })
    
    if (validFiles.length + files.length > 10) {
      alert('最多只能上传10张图片')
      return
    }
    
    setFiles(prev => [...prev, ...validFiles])
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => 
      prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    )
  }

  const toggleAllModels = () => {
    if (selectedModels.length === DEFAULT_MODELS.length) {
      setSelectedModels([])
    } else {
      setSelectedModels(DEFAULT_MODELS.map(m => m.id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (files.length === 0) {
      alert('请选择至少一张图片')
      return
    }
    
    if (selectedModels.length === 0) {
      alert('请选择至少一个分析模型')
      return
    }
    
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('prompt', prompt)
      selectedModels.forEach(model => formData.append('models', model))
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (response.ok) {
        const { taskId } = await response.json()
        router.push(`/result/${taskId}`)
      } else {
        const error = await response.text()
        alert(`上传失败: ${error}`)
      }
    } catch (error) {
      alert(`上传失败: ${error}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gradient mb-4">
          AI图片分析系统
        </h1>
        <p className="text-lg text-gray-600">
          上传图片，使用多个AI模型进行智能分析，生成详细的分析报告
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 文件上传区域 */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Upload className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold">上传图片</h2>
          </div>
          
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              拖拽图片到此处或点击选择文件
            </p>
            <p className="text-sm text-gray-500 mb-4">
              支持 PNG, JPG, JPEG, GIF, BMP, TIFF 格式，单个文件最大16MB，最多10张
            </p>
            <input
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.gif,.bmp,.tiff"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="btn-primary cursor-pointer inline-block">
              选择文件
            </label>
          </div>
          
          {files.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">已选择 {files.length} 个文件：</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {files.map((file, index) => (
                  <div key={index} className="relative bg-gray-100 rounded-lg p-2">
                    <p className="text-xs text-gray-700 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 分析提示词 */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Sparkles className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold">分析提示词</h2>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="input-field h-24 resize-none"
            placeholder="请输入您希望AI如何分析这些图片..."
          />
          <p className="text-sm text-gray-500 mt-2">
            可以自定义分析角度和要求，留空则使用默认提示词
          </p>
        </div>

        {/* 模型选择 */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Settings className="w-5 h-5 text-primary-600 mr-2" />
              <h2 className="text-xl font-semibold">选择分析模型</h2>
            </div>
            <button
              type="button"
              onClick={toggleAllModels}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              {selectedModels.length === DEFAULT_MODELS.length ? '取消全选' : '全选'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DEFAULT_MODELS.map((model) => (
              <label key={model.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedModels.includes(model.id)}
                  onChange={() => toggleModel(model.id)}
                  className="mt-1 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{model.name}</p>
                  <p className="text-sm text-gray-500">{model.description}</p>
                </div>
              </label>
            ))}
          </div>
          
          <p className="text-sm text-gray-500 mt-4">
            已选择 {selectedModels.length} 个模型。建议选择多个模型以获得更全面的分析结果。
          </p>
        </div>

        {/* 提交按钮 */}
        <div className="text-center">
          <button
            type="submit"
            disabled={isUploading || files.length === 0 || selectedModels.length === 0}
            className="btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                上传中...
              </div>
            ) : (
              <div className="flex items-center">
                <Sparkles className="w-5 h-5 mr-2" />
                开始分析
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}