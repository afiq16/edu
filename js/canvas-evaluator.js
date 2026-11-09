/**
 * Digital Khata Evaluator Engine
 * Complete Canvas Drawing, Red Pen Checking, Stamps, Eraser, Text, Multi-layer undo/redo
 */

class KhataCanvasEvaluator {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Drawing state
        this.currentTool = 'pen'; // 'pen', 'highlighter', 'eraser', 'text', 'stamp'
        this.currentColor = '#ef4444'; // Red pen default for teachers
        this.brushSize = 4;
        this.currentStamp = null;

        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;

        // Image background & Annotations layer
        this.bgImage = new Image();
        this.isImageLoaded = false;
        this.history = []; // Array of ImageData for undo
        this.redoStack = [];
        this.zoomLevel = 1.0;
        this.rotationAngle = 0; // 0, 90, 180, 270 degrees

        this.initEvents();
    }

    rotateImage() {
        this.rotationAngle = (this.rotationAngle + 90) % 360;
        if (!this.isImageLoaded) return;

        // Swap width and height for 90 or 270 degree rotation
        const isPerp = this.rotationAngle === 90 || this.rotationAngle === 270;
        const origW = this.canvas.width;
        const origH = this.canvas.height;

        // Create temporary canvas to hold current drawings
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = origW;
        tempCanvas.height = origH;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        // Adjust canvas dimensions
        this.canvas.width = origH;
        this.canvas.height = origW;

        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.rotate((90 * Math.PI) / 180);
        this.ctx.drawImage(tempCanvas, -origW / 2, -origH / 2);
        this.ctx.restore();

        this.saveHistoryState();
    }

    setZoom(level) {
        this.zoomLevel = Math.max(0.6, Math.min(2.5, Math.round(level * 10) / 10));
        const wrapper = document.getElementById('canvasWrapper');
        if (wrapper) {
            wrapper.style.transform = `scale(${this.zoomLevel})`;
            wrapper.style.transformOrigin = 'top center';
            wrapper.style.transition = 'transform 0.15s ease-out';
        }
        const zoomDisplay = document.getElementById('canvasZoomDisplay');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }

    zoomIn() {
        this.setZoom(this.zoomLevel + 0.2);
    }

    zoomOut() {
        this.setZoom(this.zoomLevel - 0.2);
    }

    resetZoom() {
        this.setZoom(1.0);
    }

    /**
     * Load student's khata image into canvas
     */
    loadImage(imageSrc) {
        return new Promise((resolve) => {
            this.bgImage = new Image();
            this.bgImage.crossOrigin = "anonymous";
            this.bgImage.onload = () => {
                this.isImageLoaded = true;

                // Max canvas dimensions based on viewport
                const maxWidth = 900;
                let width = this.bgImage.naturalWidth || 800;
                let height = this.bgImage.naturalHeight || 1000;

                if (width > maxWidth) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height = height * ratio;
                }

                // If on mobile, scale to fit width nicely
                if (window.innerWidth < 768) {
                    const mobileMax = window.innerWidth - 30;
                    if (width > mobileMax) {
                        const ratio = mobileMax / width;
                        width = mobileMax;
                        height = height * ratio;
                    }
                }

                this.canvas.width = width;
                this.canvas.height = height;

                // Render background image
                this.redrawBaseImage();
                this.resetZoom();

                // Save baseline state to history
                this.saveHistoryState();
                resolve(true);
            };

            this.bgImage.onerror = () => {
                // If broken image, generate clean paper grid background
                this.createBlankPaper();
                this.saveHistoryState();
                resolve(false);
            };

            this.bgImage.src = imageSrc;
        });
    }

    createBlankPaper() {
        this.canvas.width = 750;
        this.canvas.height = 950;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw light notebook lines
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 1;
        for (let y = 50; y < this.canvas.height; y += 30) {
            this.ctx.beginPath();
            this.ctx.moveTo(40, y);
            this.ctx.lineTo(this.canvas.width - 40, y);
            this.ctx.stroke();
        }

        // Draw left margin line
        this.ctx.strokeStyle = '#fca5a5';
        this.ctx.beginPath();
        this.ctx.moveTo(80, 0);
        this.ctx.lineTo(80, this.canvas.height);
        this.ctx.stroke();

        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '16px Hind Siliguri, sans-serif';
        this.ctx.fillText("হোমওয়ার্ক খাতার পৃষ্ঠা (নমুনা)", 100, 40);
    }

    redrawBaseImage() {
        if (!this.isImageLoaded) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
    }

    saveHistoryState() {
        if (this.history.length >= 25) {
            this.history.shift(); // Keep max 25 undo steps
        }
        const state = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.history.push(state);
        this.redoStack = []; // Clear redo stack on new action
    }

    undo() {
        if (this.history.length > 1) {
            const current = this.history.pop();
            this.redoStack.push(current);
            const previous = this.history[this.history.length - 1];
            this.ctx.putImageData(previous, 0, 0);
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const next = this.redoStack.pop();
            this.history.push(next);
            this.ctx.putImageData(next, 0, 0);
        }
    }

    clearAll() {
        if (confirm("আপনি কি খাতার সকল লাল কালির দাগ ও মূল্যায়ন মুছে ফেলতে চান?")) {
            this.redrawBaseImage();
            this.saveHistoryState();
        }
    }

    // Bind touch & mouse events
    initEvents() {
        // Pointer down
        const startDraw = (e) => {
            const pos = this.getCanvasPos(e);
            this.isDrawing = true;
            this.lastX = pos.x;
            this.lastY = pos.y;

            if (this.currentTool === 'stamp') {
                this.drawStamp(pos.x, pos.y, this.currentStamp);
                this.saveHistoryState();
                this.isDrawing = false;
                return;
            }

            if (this.currentTool === 'text') {
                const text = prompt("খাতায় লেখার জন্য মন্তব্য বা নম্বর লিখুন:", "10/10");
                if (text) {
                    this.drawText(pos.x, pos.y, text);
                    this.saveHistoryState();
                }
                this.isDrawing = false;
                return;
            }

            // For pen or eraser, draw initial dot
            this.draw(pos.x, pos.y, true);
        };

        // Pointer move
        const moveDraw = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            const pos = this.getCanvasPos(e);
            this.draw(pos.x, pos.y, false);
            this.lastX = pos.x;
            this.lastY = pos.y;
        };

        // Pointer up / end
        const endDraw = () => {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.saveHistoryState();
            }
        };

        // Mouse Listeners
        this.canvas.addEventListener('mousedown', startDraw);
        this.canvas.addEventListener('mousemove', moveDraw);
        window.addEventListener('mouseup', endDraw);

        // Touch Listeners (Mobile & Tablet Pen support)
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startDraw(e.touches[0]);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                moveDraw(e.touches[0]);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', endDraw);
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    draw(x, y, isStart = false) {
        this.ctx.beginPath();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (this.currentTool === 'highlighter') {
            this.ctx.globalAlpha = 0.35;
            this.ctx.strokeStyle = this.currentColor === '#ef4444' ? '#fde047' : this.currentColor;
            this.ctx.lineWidth = this.brushSize * 4;
            this.ctx.globalCompositeOperation = 'source-over';
        } else if (this.currentTool === 'eraser') {
            // Smart Eraser: Erase by redrawing original background image on top in circular radius
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.brushSize * 3, 0, Math.PI * 2);
            this.ctx.clip();
            if (this.isImageLoaded) {
                this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
            } else {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fill();
            }
            this.ctx.restore();
            return;
        } else {
            // Normal Pen
            this.ctx.globalAlpha = 1.0;
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.brushSize;
            this.ctx.globalCompositeOperation = 'source-over';
        }

        if (isStart) {
            this.ctx.moveTo(x - 0.5, y - 0.5);
            this.ctx.lineTo(x, y);
        } else {
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(x, y);
        }

        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    drawText(x, y, text) {
        this.ctx.save();
        this.ctx.font = `bold ${Math.max(18, this.brushSize * 4)}px Hind Siliguri, sans-serif`;
        this.ctx.fillStyle = this.currentColor;
        this.ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
    }

    drawStamp(x, y, stampType) {
        this.ctx.save();

        if (stampType === 'tick') {
            // Green check mark
            this.ctx.strokeStyle = '#10b981';
            this.ctx.lineWidth = 5;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(x - 14, y);
            this.ctx.lineTo(x - 3, y + 12);
            this.ctx.lineTo(x + 18, y - 14);
            this.ctx.stroke();
        } else if (stampType === 'cross') {
            // Red cross mark
            this.ctx.strokeStyle = '#ef4444';
            this.ctx.lineWidth = 5;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(x - 12, y - 12);
            this.ctx.lineTo(x + 12, y + 12);
            this.ctx.moveTo(x + 12, y - 12);
            this.ctx.lineTo(x - 12, y + 12);
            this.ctx.stroke();
        } else if (stampType === 'circle') {
            // Blue highlight circle
            this.ctx.strokeStyle = '#3b82f6';
            this.ctx.lineWidth = 3.5;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 22, 0, Math.PI * 2);
            this.ctx.stroke();
        } else if (stampType === 'star') {
            // Gold Star
            this.ctx.font = '32px serif';
            this.ctx.fillText('⭐', x - 16, y + 11);
        } else if (stampType === 'hundred') {
            // 100% Badge
            this.ctx.font = 'bold 28px sans-serif';
            this.ctx.fillText('💯', x - 18, y + 10);
        } else if (stampType === 'doubt') {
            // Red Question Mark
            this.ctx.fillStyle = '#ef4444';
            this.ctx.font = 'bold 32px sans-serif';
            this.ctx.fillText('❓', x - 14, y + 12);
        } else if (stampType === 'good') {
            // Thumbs Up
            this.ctx.font = '28px serif';
            this.ctx.fillText('👍', x - 14, y + 10);
        } else if (stampType === 'arrow') {
            // Red Arrow indicator
            this.ctx.fillStyle = '#ef4444';
            this.ctx.font = 'bold 30px sans-serif';
            this.ctx.fillText('➔', x - 12, y + 10);
        } else if (stampType === 'verygood') {
            // VG Badge
            this.ctx.fillStyle = '#8b5cf6';
            this.ctx.font = 'bold 22px Hind Siliguri, sans-serif';
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
            this.ctx.shadowBlur = 6;
            this.ctx.fillText('অসাধারণ! 🌟', x - 20, y + 6);
        }

        this.ctx.restore();
    }

    /**
     * Export final evaluated image as Base64 data URL with automatic lightweight compression
     */
    exportEvaluatedImage(format = 'image/jpeg', quality = 0.72) {
        try {
            const maxWidth = 800;
            let w = this.canvas.width;
            let h = this.canvas.height;
            if (w > maxWidth) {
                h = Math.round((h * maxWidth) / w);
                w = maxWidth;
            }
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.fillStyle = "#ffffff";
            tempCtx.fillRect(0, 0, w, h);
            tempCtx.drawImage(this.canvas, 0, 0, w, h);
            return tempCanvas.toDataURL(format, quality);
        } catch (err) {
            return this.canvas.toDataURL(format, quality);
        }
    }
}

// Global instance helper
window.KhataCanvasEvaluator = KhataCanvasEvaluator;
