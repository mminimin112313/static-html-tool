/**
 * ================================================================
 * 클래스 5: ImageProcessor - Canvas 기반 이미지 처리 (디버깅 강화)
 * (Axiom: Pragmatic Implementation)
 * ================================================================
 */
export default class ImageProcessor {
  
  constructor() {
    // 캔버스를 재사용하여 메모리 효율성 증대
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    console.log("[ImageProcessor] S_CONSTRUCT: ImageProcessor 인스턴스 생성됨.");
  }

  async processImage(file) {
    console.groupCollapsed(`[ImageProcessor] S_PROCESS: 이미지 처리 시작 (File: ${file.name})`);
    console.log(`[ImageProcessor] S_PROCESS: 원본 Size: ${file.size} bytes, Type: ${file.type}`);
    console.time("Image_Processing_Time");

    try {
      // --- Step 1: createImageBitmap ---
      console.log("[ImageProcessor] S_PROCESS: Step 1/5 - createImageBitmap 시도...");
      console.time("1_createImageBitmap");
      const bmp = await createImageBitmap(file);
      console.log(`[ImageProcessor] S_PROCESS: Step 1/5 - createImageBitmap 성공 (Dimensions: ${bmp.width}x${bmp.height})`);
      console.timeEnd("1_createImageBitmap");

      this.canvas.width = bmp.width;
      this.canvas.height = bmp.height;
      
      // --- Step 2: drawImage ---
      console.log("[ImageProcessor] S_PROCESS: Step 2/5 - Canvas에 그리기 (drawImage)...");
      this.ctx.drawImage(bmp, 0, 0);
      bmp.close(); // 비트맵 메모리 즉시 해제
      console.log("[ImageProcessor] S_PROCESS: Step 2/5 - drawImage 성공 및 비트맵 해제.");

      // --- Step 3: applyNoise ---
      console.log("[ImageProcessor] S_PROCESS: Step 3/5 - 노이즈 적용 (applyNoise)...");
      this.applyNoise(this.ctx, this.canvas.width, this.canvas.height);
      console.log("[ImageProcessor] S_PROCESS: Step 3/5 - 노이즈 적용 완료.");

      // --- Step 4: applyNoiseBorder ---
      console.log("[ImageProcessor] S_PROCESS: Step 4/5 - 노이즈 테두리 적용 (applyNoiseBorder)...");
      this.applyNoiseBorder(this.ctx, this.canvas.width, this.canvas.height);
      console.log("[ImageProcessor] S_PROCESS: Step 4/5 - 노이즈 테두리 적용 완료.");
      
      // --- Step 5: toBlob (WebP) ---
      console.log("[ImageProcessor] S_PROCESS: Step 5/5 - WebP Blob 변환 (toBlob) 시도...");
      console.time("5_toBlob");
      const blob = await new Promise((resolve, reject) => {
          this.canvas.toBlob(
            (b) => {
              if (b) {
                resolve(b);
              } else {
                reject(new Error("Canvas toBlob이 null을 반환했습니다. (이미지 크기가 너무 크거나 0일 수 있음)"));
              }
            }, 
            'image/webp', 
            0.9
          );
      });
      console.timeEnd("5_toBlob");
      console.log(`[ImageProcessor] S_PROCESS: Step 5/5 - WebP Blob 변환 성공 (New Size: ${blob.size} bytes)`);
      
      console.timeEnd("Image_Processing_Time");
      console.groupEnd();
      return blob;

    } catch (e) {
      console.error("[ImageProcessor] E_PROCESS: 이미지 처리 중 치명적 오류 발생.", e);
      console.timeEnd("Image_Processing_Time"); // 오류가 나더라도 시간 측정 종료
      console.groupEnd();
      throw e; // [중요] 오류를 상위로 전파
    }
  }
  
  applyNoise(ctx, width, height, intensity = 3) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // 알파 채널(data[i+3])이 0이 아닌 픽셀에만 노이즈 적용
      if (data[i+3] !== 0) {
        const noise = (Math.random() - 0.5) * intensity;
        data[i]   = Math.max(0, Math.min(255, data[i] + noise)); // R
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise)); // G
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise)); // B
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
  
  applyNoiseBorder(ctx, width, height) {
    const randomGray = () => Math.floor(Math.random() * 5) + 1; // 1~5 사이의 회색
    
    // Top, Bottom
    for (let x = 0; x < width; x++) {
      if (Math.random() > 0.5) {
        const c = randomGray();
        ctx.fillStyle = `rgb(${c},${c},${c})`;
        ctx.fillRect(x, 0, 1, 1); // Top
      }
      if (Math.random() > 0.5) {
        const c = randomGray();
        ctx.fillStyle = `rgb(${c},${c},${c})`;
        ctx.fillRect(x, height - 1, 1, 1); // Bottom
      }
    }
    // Left, Right
    for (let y = 0; y < height; y++) {
      if (Math.random() > 0.5) {
        const c = randomGray();
        ctx.fillStyle = `rgb(${c},${c},${c})`;
        ctx.fillRect(0, y, 1, 1); // Left
      }
      if (Math.random() > 0.5) {
        const c = randomGray();
        ctx.fillStyle = `rgb(${c},${c},${c})`;
        ctx.fillRect(width - 1, y, 1, 1); // Right
      }
    }
  }
}