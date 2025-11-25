import React, { useState, useRef, useEffect, useCallback } from 'react';
import { processSignatureCrop, loadImage } from './utils/imageProcessing';
import { recognizeSignature } from './services/geminiService';
import { SignatureItem, Rect, Point, ProcessingStatus, AIProvider } from './types';
import { 
  UploadIcon, ScissorIcon, DownloadIcon, LoaderIcon, 
  SparklesIcon, XIcon, UndoIcon, ZoomInIcon, ZoomOutIcon, ResetIcon, HandIcon, SettingsIcon, MaximizeIcon
} from './components/Icons';

export default function App() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [signatures, setSignatures] = useState<SignatureItem[]>([]);
  
  // Settings & API Keys
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('zhipu');
  const [zhipuKey, setZhipuKey] = useState('');
  const [aliyunKey, setAliyunKey] = useState('');
  
  // Temp state for settings dialog
  const [tempProvider, setTempProvider] = useState<AIProvider>('zhipu');
  const [tempZhipuKey, setTempZhipuKey] = useState('');
  const [tempAliyunKey, setTempAliyunKey] = useState('');

  // Selection & Viewport States
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null); 
  const [panStart, setPanStart] = useState<Point | null>(null); 
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  
  // Undo Stack
  const [undoStack, setUndoStack] = useState<SignatureItem[]>([]);

  // Viewport Transform State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Sidebar Resizing State
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // Preview Modal State
  const [previewSig, setPreviewSig] = useState<SignatureItem | null>(null);
  const [pScale, setPScale] = useState(1);
  const [pPan, setPPan] = useState({ x: 0, y: 0 });
  const [isPPanning, setIsPPanning] = useState(false);
  const [pPanStart, setPPanStart] = useState<Point | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Refs
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load Settings on Mount
  useEffect(() => {
    const storedProvider = localStorage.getItem('ai_provider') as AIProvider;
    const storedZhipu = localStorage.getItem('api_key_zhipu');
    const storedAliyun = localStorage.getItem('api_key_aliyun');

    if (storedProvider) setProvider(storedProvider);
    if (storedZhipu) setZhipuKey(storedZhipu);
    if (storedAliyun) setAliyunKey(storedAliyun);
  }, []);

  const openSettings = () => {
    setTempProvider(provider);
    setTempZhipuKey(zhipuKey);
    setTempAliyunKey(aliyunKey);
    setIsSettingsOpen(true);
  };

  const saveSettings = () => {
    localStorage.setItem('ai_provider', tempProvider);
    localStorage.setItem('api_key_zhipu', tempZhipuKey.trim());
    localStorage.setItem('api_key_aliyun', tempAliyunKey.trim());

    setProvider(tempProvider);
    setZhipuKey(tempZhipuKey.trim());
    setAliyunKey(tempAliyunKey.trim());
    setIsSettingsOpen(false);
  };

  const getActiveKey = () => {
    return provider === 'zhipu' ? zhipuKey : aliyunKey;
  };

  // Sidebar Resizing Logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setSidebarWidth(Math.max(280, Math.min(newWidth, 800)));
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isSettingsOpen && !previewSig) {
        setIsSpacePressed(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isSettingsOpen && !previewSig) {
         handleUndo();
      }
      if (e.key === 'Escape' && previewSig) {
        closePreview();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [signatures, isSettingsOpen, undoStack, previewSig]);

  // Load image object
  useEffect(() => {
    if (sourceImage) {
      loadImage(sourceImage).then(img => {
        setImageObj(img);
        setScale(1);
        setPan({ x: 0, y: 0 });
      });
    }
  }, [sourceImage]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImage(event.target?.result as string);
        setSignatures([]); 
        setUndoStack([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const lastRemoved = undoStack[undoStack.length - 1];
      setSignatures(prev => [...prev, lastRemoved]);
      setUndoStack(prev => prev.slice(0, -1));
    } else if (signatures.length > 0) {
        const lastAdded = signatures[signatures.length - 1];
        setSignatures(prev => prev.slice(0, -1));
    }
  };

  const handleRemoveSignature = (id: string) => {
    const sigToRemove = signatures.find(s => s.id === id);
    if (sigToRemove) {
      setUndoStack(prev => [...prev, sigToRemove]);
      setSignatures(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleDownload = (signature: SignatureItem) => {
    if (!signature.previewUrl) return;
    const link = document.createElement('a');
    link.href = signature.previewUrl;
    link.download = `${signature.fileName || 'signature'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllZip = async () => {
    const JSZip = (window as any).JSZip;
    if (!JSZip) {
      alert("ZIP 库加载失败，请刷新页面重试。");
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder("signatures");
    const nameCount: Record<string, number> = {};

    let hasFiles = false;

    signatures.forEach(sig => {
      if ((sig.status === ProcessingStatus.SUCCESS || sig.previewUrl) && sig.previewUrl) {
        let name = sig.fileName.trim() || `signature_${sig.id}`;
        name = name.replace(/[<>:"/\\|?*]+/g, '_');
        
        if (nameCount[name]) {
          nameCount[name]++;
          name = `${name}_${nameCount[name]}`;
        } else {
          nameCount[name] = 1;
        }

        const base64Data = sig.previewUrl.replace(/^data:image\/(png|jpg);base64,/, "");
        folder.file(`${name}.png`, base64Data, {base64: true});
        hasFiles = true;
      }
    });

    if (hasFiles) {
      try {
        const content = await zip.generateAsync({type:"blob"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `手写签名打包_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.error("Zip generation failed", e);
        alert("打包失败");
      }
    } else {
      alert("没有可下载的有效签名");
    }
  };

  // --- Main Canvas Viewport Logic ---
  const getContentCoordinates = (e: React.MouseEvent | React.TouchEvent, viewport: HTMLDivElement): Point => {
    const rect = viewport.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;

    return {
      x: (viewportX - pan.x) / scale,
      y: (viewportY - pan.y) / scale
    };
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!viewportRef.current) return;
    e.preventDefault();

    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newScale = Math.min(5, Math.max(0.1, scale + delta));
    
    const rect = viewportRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const contentX = (cursorX - pan.x) / scale;
    const contentY = (cursorY - pan.y) / scale;

    const newPanX = cursorX - contentX * newScale;
    const newPanY = cursorY - contentY * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleZoomIn = () => {
     if (!viewportRef.current) return;
     const newScale = Math.min(5, scale * 1.2);
     updateZoomCenter(newScale);
  };

  const handleZoomOut = () => {
    if (!viewportRef.current) return;
    const newScale = Math.max(0.1, scale / 1.2);
    updateZoomCenter(newScale);
  };

  const handleResetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const updateZoomCenter = (newScale: number) => {
      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const contentX = (centerX - pan.x) / scale;
      const contentY = (centerY - pan.y) / scale;
      
      const newPanX = centerX - contentX * newScale;
      const newPanY = centerY - contentY * newScale;
      
      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
  }

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.delete-btn')) return;
    if ((e.target as HTMLElement).closest('button')) return;
    
    if (!viewportRef.current || !sourceImage) return;

    const isMiddleClick = 'button' in e && (e as React.MouseEvent).button === 1;
    
    if (isSpacePressed || isMiddleClick) {
      e.preventDefault();
      setIsPanning(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setPanStart({ x: clientX, y: clientY });
    } else {
      if ('button' in e && (e as React.MouseEvent).button !== 0) return;
      
      const point = getContentCoordinates(e, viewportRef.current);
      setIsDrawing(true);
      setStartPoint(point);
      setCurrentRect({ x: point.x, y: point.y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!viewportRef.current) return;

    if (isPanning && panStart) {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      const dx = clientX - panStart.x;
      const dy = clientY - panStart.y;
      
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: clientX, y: clientY });
      return;
    }

    if (isDrawing && startPoint) {
      const currentPoint = getContentCoordinates(e, viewportRef.current);
      
      const width = currentPoint.x - startPoint.x;
      const height = currentPoint.y - startPoint.y;

      setCurrentRect({
        x: width > 0 ? startPoint.x : currentPoint.x,
        y: height > 0 ? startPoint.y : currentPoint.y,
        width: Math.abs(width),
        height: Math.abs(height)
      });
    }
  };

  const handleMouseUp = async () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    if (!isDrawing || !currentRect || !imageObj || !contentRef.current) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentRect(null);
      return;
    }

    if (currentRect.width < 5 || currentRect.height < 5) {
        setIsDrawing(false);
        setStartPoint(null);
        setCurrentRect(null);
        return;
    }

    const displayedRect = currentRect;
    const currentApiKey = getActiveKey();
    const currentProvider = provider;
    
    const imgElement = contentRef.current.querySelector('img');
    if (!imgElement) return;

    const renderWidth = imgElement.offsetWidth;
    const renderHeight = imgElement.offsetHeight;
    const naturalWidth = imageObj.naturalWidth;
    const naturalHeight = imageObj.naturalHeight;

    const ratioX = naturalWidth / renderWidth;
    const ratioY = naturalHeight / renderHeight;
    
    const actualCropRect: Rect = {
      x: displayedRect.x * ratioX,
      y: displayedRect.y * ratioY,
      width: displayedRect.width * ratioX,
      height: displayedRect.height * ratioY
    };

    const newId = Date.now().toString();

    const newSignature: SignatureItem = {
      id: newId,
      originalRect: displayedRect,
      previewUrl: '', 
      fileName: '识别中...',
      status: ProcessingStatus.PROCESSING
    };

    setSignatures(prev => [...prev, newSignature]);
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentRect(null);

    try {
      const { blobUrl, base64Data } = processSignatureCrop(imageObj, actualCropRect);

      setSignatures(prev => prev.map(s => 
        s.id === newId ? { ...s, previewUrl: blobUrl } : s
      ));

      if (!currentApiKey) {
        setSignatures(prev => prev.map(s => 
          s.id === newId ? { 
            ...s, 
            fileName: "未配置API Key", 
            status: ProcessingStatus.ERROR 
          } : s
        ));
        if (!isSettingsOpen) setIsSettingsOpen(true);
        return;
      }

      const recognizedName = await recognizeSignature(base64Data, currentApiKey, currentProvider);
      
      setSignatures(prev => prev.map(s => 
        s.id === newId ? { 
          ...s, 
          fileName: recognizedName, 
          status: recognizedName.includes('失败') || recognizedName.includes('Key') ? ProcessingStatus.ERROR : ProcessingStatus.SUCCESS
        } : s
      ));

    } catch (error) {
      console.error(error);
      setSignatures(prev => prev.map(s => 
        s.id === newId ? { ...s, fileName: "处理错误", status: ProcessingStatus.ERROR } : s
      ));
    }
  };

  // --- Preview Modal Logic ---
  const openPreview = (sig: SignatureItem) => {
    setPreviewSig(sig);
    setPScale(1);
    setPPan({ x: 0, y: 0 });
  };
  
  const closePreview = () => {
    setPreviewSig(null);
  };

  const handlePreviewWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newScale = Math.min(10, Math.max(0.1, pScale + delta));
    setPScale(newScale);
  };

  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPPanning(true);
    setPPanStart({ x: e.clientX, y: e.clientY });
  };

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (isPPanning && pPanStart) {
      e.preventDefault();
      const dx = e.clientX - pPanStart.x;
      const dy = e.clientY - pPanStart.y;
      setPPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePreviewMouseUp = () => {
    setIsPPanning(false);
    setPPanStart(null);
  };

  const handlePreviewZoomIn = () => setPScale(s => Math.min(10, s * 1.2));
  const handlePreviewZoomOut = () => setPScale(s => Math.max(0.1, s / 1.2));
  const handlePreviewReset = () => {
    setPScale(1);
    setPPan({ x: 0, y: 0 });
  };

  const cursorStyle = isPanning ? 'grabbing' : (isSpacePressed ? 'grab' : 'crosshair');

  // --- Main App ---
  return (
    <div className="flex h-screen bg-[#F5F5F7] text-[#1d1d1f] overflow-hidden select-none font-sans">
      
      {/* Resizable Sidebar */}
      <div 
        className="relative bg-white/80 backdrop-blur-xl border-r border-black/5 flex flex-col shadow-[0_0_20px_rgba(0,0,0,0.02)] z-20 transition-[width] duration-0 ease-linear"
        style={{ width: sidebarWidth }}
      >
        <div className="px-6 py-6 border-b border-black/5 flex-shrink-0">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-[#1d1d1f]">
            <div className="w-7 h-7 bg-[#0071e3] rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                <SparklesIcon className="text-white w-4 h-4" />
            </div>
            <span className="truncate">智能签名提取</span>
          </h1>
          <div className="flex items-center justify-between mt-4">
             <p className="text-[10px] uppercase font-bold tracking-wider text-[#86868b] truncate mr-2">
                {provider === 'zhipu' ? 'GLM-4 (智谱)' : 'Qwen-VL (阿里云)'}
             </p>
             <div className="flex gap-1 flex-shrink-0">
               <button 
                  onClick={handleUndo}
                  disabled={signatures.length === 0 && undoStack.length === 0}
                  className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30 transition-all active:scale-95"
                  title="撤销 (Ctrl+Z)"
                >
                  <UndoIcon className="w-4 h-4 text-[#1d1d1f]" />
                </button>
                <button 
                  onClick={openSettings}
                  className="p-1.5 rounded-full hover:bg-black/5 transition-all active:scale-95"
                  title="设置"
                >
                  <SettingsIcon className="w-4 h-4 text-[#1d1d1f]" />
                </button>
             </div>
          </div>
        </div>

        {/* Scrollable Area with Fixed 2-Column Grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
          {signatures.length === 0 ? (
            <div className="text-center py-20 text-[#86868b] flex flex-col items-center">
              <div className="w-14 h-14 bg-black/5 rounded-full flex items-center justify-center mb-4">
                 <ScissorIcon className="w-6 h-6 opacity-30" />
              </div>
              <p className="text-sm font-medium">暂无签名</p>
              <p className="text-xs mt-1 opacity-70">在右侧图片上框选区域</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pb-4">
              {/* Reverse order to show newest first */}
              {[...signatures].reverse().map((sig) => (
                <div key={sig.id} className="bg-white rounded-2xl p-3 shadow-sm border border-black/5 hover:shadow-md transition-all relative flex flex-col group">
                  
                  {/* Remove Button - Top Right (Visible on Card) */}
                   <button 
                    onClick={() => handleRemoveSignature(sig.id)}
                    className="absolute top-2 right-2 z-10 bg-white/90 text-[#86868b] hover:text-[#ff3b30] rounded-full p-1.5 shadow-sm border border-black/5 hover:scale-110 transition-all"
                    title="移除"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>

                  {/* Image Preview Area - Clickable */}
                  <div 
                    onClick={() => openPreview(sig)}
                    className="aspect-[4/3] bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] rounded-xl border border-black/5 flex items-center justify-center mb-2 overflow-hidden bg-gray-50/50 cursor-zoom-in relative group/image"
                    title="点击放大查看"
                  >
                    {sig.previewUrl && (
                      <img src={sig.previewUrl} alt="Signature" className="max-h-full max-w-full object-contain p-2 transition-transform duration-300 group-hover/image:scale-105" />
                    )}
                    {/* Hover Overlay Hint */}
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                       <div className="bg-white/90 p-1.5 rounded-full shadow-sm">
                         <MaximizeIcon className="w-4 h-4 text-[#1d1d1f]" />
                       </div>
                    </div>
                  </div>
                  
                  {/* Status & Name Input */}
                  <div className="px-1 mb-3">
                    {sig.status === ProcessingStatus.PROCESSING ? (
                      <div className="flex items-center gap-1.5 text-[#0071e3] text-xs font-medium h-5">
                        <LoaderIcon className="w-3 h-3" />
                        <span>识别中...</span>
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        defaultValue={sig.fileName}
                        className={`w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 focus:outline-none focus:bg-gray-50 rounded px-1 -ml-1 truncate ${sig.status === ProcessingStatus.ERROR ? 'text-red-500' : 'text-[#1d1d1f]'}`}
                        onBlur={(e) => {
                          const newName = e.target.value;
                          setSignatures(prev => prev.map(s => s.id === sig.id ? { ...s, fileName: newName } : s));
                        }}
                      />
                    )}
                  </div>

                  {/* Prominent Download Button */}
                  <button
                    onClick={() => handleDownload(sig)}
                    className="mt-auto w-full bg-[#0071e3] hover:bg-[#0077ED] text-white text-xs font-medium py-2 rounded-lg shadow-sm shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                    title="下载此签名"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    下载 PNG
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 bg-white/50 backdrop-blur-xl border-t border-black/5 flex-shrink-0">
          {signatures.length === 0 ? (
            <label className="flex items-center justify-center gap-2 w-full bg-[#0071e3] hover:bg-[#0077ED] text-white py-3 rounded-xl cursor-pointer transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-[0.98]">
              <UploadIcon className="w-4 h-4" />
              <span className="text-sm font-medium">上传图片</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          ) : (
             <div className="flex flex-col gap-2">
                <button 
                 onClick={handleDownloadAllZip}
                 className="w-full flex items-center justify-center gap-2 bg-[#1d1d1f] hover:bg-black text-white py-3 rounded-xl shadow-lg shadow-black/10 active:scale-[0.98] transition-all"
               >
                 <DownloadIcon className="w-4 h-4" />
                 <span className="text-sm font-medium">批量导出 ZIP ({signatures.length})</span>
               </button>
               
               <label className="w-full flex items-center justify-center gap-2 text-[#0071e3] hover:bg-[#0071e3]/5 py-2 rounded-xl cursor-pointer transition-all text-xs font-medium">
                  更换图片
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
               </label>
             </div>
          )}
        </div>
        
        {/* Resize Handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0071e3] transition-colors z-30"
          onMouseDown={startResizing}
        />
      </div>

      {/* Main Workspace - Dot Pattern Background */}
      <div className="flex-1 relative bg-[#F5F5F7] overflow-hidden flex flex-col dot-pattern">
        
        {/* Floating Toolbar - Apple Style */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-6 py-2.5 flex items-center gap-5 z-20 border border-white/20 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)]">
           <div className="flex items-center gap-1">
             <button onClick={handleZoomOut} className="p-2 hover:bg-black/5 rounded-full text-[#1d1d1f] transition-colors active:scale-90" title="缩小">
               <ZoomOutIcon className="w-5 h-5" />
             </button>
             <span className="text-xs font-medium font-mono w-10 text-center text-[#86868b]">{Math.round(scale * 100)}%</span>
             <button onClick={handleZoomIn} className="p-2 hover:bg-black/5 rounded-full text-[#1d1d1f] transition-colors active:scale-90" title="放大">
               <ZoomInIcon className="w-5 h-5" />
             </button>
           </div>
           
           <div className="w-px h-5 bg-black/10"></div>
           
           <button onClick={handleResetView} className="p-2 hover:bg-black/5 rounded-full text-[#1d1d1f] transition-colors active:scale-90" title="复位视图">
             <ResetIcon className="w-4 h-4" />
           </button>
           
           <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${isPanning || isSpacePressed ? 'bg-[#0071e3] text-white shadow-md' : 'bg-black/5 text-[#86868b]'}`}>
              <HandIcon className="w-3.5 h-3.5" />
              <span>空格平移</span>
           </div>
        </div>

        {/* Canvas Area */}
        <div 
          ref={viewportRef}
          className="flex-1 w-full h-full relative overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: cursorStyle }}
        >
          {!sourceImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-24 h-24 bg-white rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex items-center justify-center mb-6 border border-white/50">
                <UploadIcon className="w-10 h-10 text-[#0071e3]" />
              </div>
              <p className="text-xl font-semibold text-[#1d1d1f] tracking-tight">请先上传一张图片</p>
              <p className="text-sm text-[#86868b] mt-2">支持拖拽平移 • 滚轮缩放 • AI 自动识别</p>
            </div>
          )}

          {sourceImage && (
            <div 
              ref={contentRef}
              className="absolute origin-top-left shadow-2xl shadow-black/20 rounded-lg overflow-hidden ring-1 ring-black/5"
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transition: isPanning ? 'none' : 'transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
              }}
            >
              <img 
                src={sourceImage} 
                alt="Source" 
                className="max-w-none block select-none pointer-events-none"
                draggable={false}
              />
              
              {/* Interactive Overlays */}
              {signatures.map((sig) => (
                <div
                  key={sig.id}
                  className="absolute border-2 border-[#0071e3] bg-[#0071e3]/10 rounded-md group shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
                  style={{
                    left: sig.originalRect.x,
                    top: sig.originalRect.y,
                    width: sig.originalRect.width,
                    height: sig.originalRect.height,
                  }}
                >
                  <button
                    className="delete-btn absolute -top-2.5 -right-2.5 bg-[#ff3b30] text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 z-10 ring-2 ring-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSignature(sig.id);
                    }}
                    title="删除"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                  
                  <div className="absolute -bottom-8 left-0 bg-white/90 backdrop-blur-md text-[#1d1d1f] text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none border border-black/5 transform translate-y-1 group-hover:translate-y-0 z-20">
                     {sig.fileName}
                  </div>
                </div>
              ))}

              {/* Selection Box */}
              {isDrawing && currentRect && (
                <div
                  className="absolute border-2 border-[#0071e3] bg-[#0071e3]/20 rounded-md shadow-[0_0_0_10000px_rgba(0,0,0,0.1)]"
                  style={{
                    left: currentRect.x,
                    top: currentRect.y,
                    width: currentRect.width,
                    height: currentRect.height,
                  }}
                >
                  <div className="absolute -top-8 left-0 bg-[#0071e3] text-white text-xs font-medium px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <ScissorIcon className="w-3 h-3" />
                    <span>识别区域</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal - Immersive Zoom */}
      {previewSig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
           <div 
             className="absolute inset-0 flex items-center justify-center overflow-hidden"
             onMouseDown={handlePreviewMouseDown}
             onMouseMove={handlePreviewMouseMove}
             onMouseUp={handlePreviewMouseUp}
             onMouseLeave={handlePreviewMouseUp}
             onWheel={handlePreviewWheel}
           >
              <div 
                ref={previewRef}
                style={{
                  transform: `translate(${pPan.x}px, ${pPan.y}px) scale(${pScale})`,
                  cursor: isPPanning ? 'grabbing' : 'grab',
                  transition: isPPanning ? 'none' : 'transform 0.1s ease-out'
                }}
                className="bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-white shadow-2xl"
              >
                  <img src={previewSig.previewUrl} alt="Preview" className="max-w-none pointer-events-none select-none" />
              </div>
           </div>

           {/* Preview Toolbar */}
           <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#1d1d1f]/90 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl border border-white/10 z-50">
              <div className="flex items-center gap-2">
                 <button onClick={handlePreviewZoomOut} className="p-2 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors">
                   <ZoomOutIcon className="w-5 h-5" />
                 </button>
                 <span className="text-white font-mono text-sm w-12 text-center">{Math.round(pScale * 100)}%</span>
                 <button onClick={handlePreviewZoomIn} className="p-2 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors">
                   <ZoomInIcon className="w-5 h-5" />
                 </button>
              </div>

              <div className="w-px h-6 bg-white/20"></div>
              
              <button onClick={handlePreviewReset} className="text-white/80 hover:text-white text-sm font-medium hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors">
                复位
              </button>

              <button 
                onClick={() => handleDownload(previewSig)}
                className="bg-[#0071e3] hover:bg-[#0077ED] text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
              >
                 <DownloadIcon className="w-3.5 h-3.5" /> 下载
              </button>

              <div className="w-px h-6 bg-white/20"></div>

              <button onClick={closePreview} className="p-2 hover:bg-white/10 rounded-full text-white/80 hover:text-[#ff3b30] transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
           </div>
           
           {/* Top Title */}
           <div className="absolute top-10 left-1/2 -translate-x-1/2 text-white/50 font-medium text-sm tracking-wide">
              {previewSig.fileName}
           </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity">
          <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] w-full max-w-[440px] p-8 border border-white/20">
            <h2 className="text-2xl font-semibold text-[#1d1d1f] mb-6 flex items-center gap-3">
              <div className="bg-black/5 p-2 rounded-xl">
                <SettingsIcon className="w-6 h-6 text-[#86868b]" />
              </div>
              API 配置
            </h2>
            
            <p className="text-[13px] leading-relaxed text-[#86868b] mb-6 bg-[#F5F5F7] p-4 rounded-xl border border-black/5">
               密钥仅存储在您的本地浏览器中，我们无法查看。请选择服务商并输入对应的 API Key。
            </p>

            <div className="space-y-5 mb-8">
              {/* Provider Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">AI 服务商</label>
                <div className="grid grid-cols-2 gap-3 p-1 bg-[#F5F5F7] rounded-xl">
                  <button 
                    onClick={() => setTempProvider('zhipu')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${tempProvider === 'zhipu' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'bg-transparent text-[#86868b] shadow-none hover:bg-white/50'}`}
                  >
                    智谱 AI
                  </button>
                  <button 
                    onClick={() => setTempProvider('aliyun')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${tempProvider === 'aliyun' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'bg-transparent text-[#86868b] shadow-none hover:bg-white/50'}`}
                  >
                    阿里云
                  </button>
                </div>
              </div>

              {/* Key Input */}
              <div>
                   <label className="block text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">
                     {tempProvider === 'zhipu' ? 'GLM-4V API Key' : 'Qwen-VL API Key'}
                   </label>
                   <div className="relative">
                     <input 
                      type="password" 
                      value={tempProvider === 'zhipu' ? tempZhipuKey : tempAliyunKey}
                      onChange={(e) => tempProvider === 'zhipu' ? setTempZhipuKey(e.target.value) : setTempAliyunKey(e.target.value)}
                      placeholder="sk-xxxxxxxxxxxxxxxx"
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-transparent rounded-xl text-sm text-[#1d1d1f] focus:bg-white focus:ring-2 focus:ring-[#0071e3] focus:outline-none transition-all placeholder-gray-400"
                    />
                   </div>
                   <div className="mt-2 text-right">
                    <a 
                      href={tempProvider === 'zhipu' ? "https://bigmodel.cn/console/api" : "https://bailian.console.aliyun.com/"} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-xs font-medium text-[#0071e3] hover:underline inline-flex items-center gap-1"
                    >
                      获取 Key &rarr;
                    </a>
                  </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-6 py-2.5 text-[#1d1d1f] hover:bg-[#F5F5F7] rounded-full text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button 
                onClick={saveSettings}
                className="px-6 py-2.5 bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full text-sm font-medium shadow-lg shadow-blue-500/30 transition-all active:scale-95"
              >
                保存更改
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}