/**
 * ================================================================
 * 클래스 4: ImageDB - IndexedDB 스토리지 (VideoStore 추가)
 * ================================================================
 */
export default class ImageDB {
  constructor() {
    this.db = null;
this.dbName = 'BlogImageStore';
    this.imageStoreName = 'images';
    this.bgmStoreName = 'bgmStore';
    this.videoStoreName = 'videos';
    this.defaultImageStoreName = 'defaultImages'; // ✨ [신규]
console.log("[ImageDB] S_CONSTRUCT: ImageDB 인스턴스 생성됨.");
}

  async init() {
    console.groupCollapsed("[ImageDB] S_INIT: IndexedDB 초기화 시도...");
    console.time("DB_Init");
return new Promise((resolve, reject) => {
      if (this.db) {
        console.log("[ImageDB] S_INIT: DB가 이미 초기화되어 있음.");
        console.timeEnd("DB_Init");
        console.groupEnd();
        return resolve(this.db);
      }
      
      // ✨ [수정] 버전 4로 업그레이드 (defaultImageStoreName 추가)
      const request = indexedDB.open(this.dbName, 4); 
      
      request.onblocked = 
(e) => {
        console.error("[ImageDB] E_INIT: DB 열기 요청이 차단되었습니다 (onblocked).");
        console.warn("[ImageDB] E_INIT: 이 앱을 연 다른 브라우저 탭을 모두 닫고 새로고침하세요.");
        console.groupEnd();
        alert("데이터베이스 연결이 다른 탭에 의해 차단되었습니다.\n\n이 앱을 연 다른 모든 탭을 닫고 페이지를 새로고침하세요.");
        reject(new Error("IndexedDB가 다른 탭에 의해 차단되었습니다."));
      };

      request.onerror = (e) => {
        
console.error("[ImageDB] E_INIT: DB 열기 실패.", e.target.error);
        console.timeEnd("DB_Init");
        console.groupEnd();
        reject(`IndexedDB 오류: ${e.target.errorCode}`);
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
console.log("[ImageDB] S_INIT: DB 열기 성공.");

        this.db.onversionchange = () => {
          console.warn("[ImageDB] W_RUNTIME: 외부에서 DB 버전 변경이 감지되었습니다. 연결을 닫습니다.");
if (this.db) {
            this.db.close();
            this.db = null;
}
          alert("애플리케이션이 업데이트되었습니다. 페이지를 새로고침합니다.");
          location.reload();
        };

        console.timeEnd("DB_Init");
        console.groupEnd();
        resolve(this.db);
      };
request.onupgradeneeded = (e) => {
        console.log("[ImageDB] S_INIT: DB 업그레이드 필요 (onupgradeneeded).");
const db = e.target.result;
        if (!db.objectStoreNames.contains(this.imageStoreName)) {
          console.log(`[ImageDB] S_INIT: '${this.imageStoreName}' ObjectStore 생성 중...`);
const store = db.createObjectStore(this.imageStoreName, { autoIncrement: true });
          store.createIndex('postId', 'postId', { unique: false });
}
        if (!db.objectStoreNames.contains(this.bgmStoreName)) {
          console.log(`[ImageDB] S_INIT: '${this.bgmStoreName}' ObjectStore 생성 중...`);
db.createObjectStore(this.bgmStoreName, { keyPath: 'id' });
        }
        // [신규] 비디오 스토어 생성 (postId를 키로 사용)
        if (!db.objectStoreNames.contains(this.videoStoreName)) {
          console.log(`[ImageDB] S_INIT: '${this.videoStoreName}' ObjectStore 생성 중...`);
db.createObjectStore(this.videoStoreName, { keyPath: 'postId' });
        }
        // ✨ [신규] 기본 이미지 스토어 생성
        if (!db.objectStoreNames.contains(this.defaultImageStoreName)) {
          console.log(`[ImageDB] S_INIT: '${this.defaultImageStoreName}' ObjectStore 생성 중...`);
          const store = db.createObjectStore(this.defaultImageStoreName, { autoIncrement: true });
          store.createIndex('name', 'name', { unique: false });
        }
        console.log("[ImageDB] S_INIT: DB 업그레이드 완료.");
      };
    });
}

  
  async addImage(postId, type, blob) {
    console.groupCollapsed(`[ImageDB] S_ADD_IMG: 이미지 추가 시도 (PostID: ${postId})`);
console.log(`[ImageDB] S_ADD_IMG: Type: ${type}, Blob Size: ${blob.size} bytes`);
    
    if (!this.db) await this.init();
return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.imageStoreName, 'readwrite');
        const store = tx.objectStore(this.imageStoreName);
        store.add({ postId, type, blob, createdAt: new Date() });
        
        tx.oncomplete = () => {
          console.log("[ImageDB] S_ADD_IMG: 이미지 저장 트랜잭션 완료.");
          console.groupEnd();
     
     resolve();
        };
        tx.onerror = (e) => {
          console.error("[ImageDB] E_ADD_IMG: 이미지 저장 트랜잭션 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error); 
        };
      } catch (e) {
        console.error("[ImageDB] E_ADD_IMG: 트랜잭션 생성 중 예외 발생.", e);
      
  console.groupEnd();
        reject(e); 
      }
    });
}

  async getImagesForPost(postId) {
    console.groupCollapsed(`[ImageDB] S_GET_IMGS: 게시물 이미지 조회 (PostID: ${postId})`);
    
    if (!this.db) await this.init();
return new Promise((resolve, reject) => {
      const images = [];
      try {
        const tx = this.db.transaction(this.imageStoreName, 'readonly');
        const store = tx.objectStore(this.imageStoreName);
        const index = store.index('postId');
        const request = index.openCursor(IDBKeyRange.only(postId)); 
        
        request.onsuccess = (e) => {
          const cursor = 
e.target.result;
          if (cursor) {
            images.push({ id: cursor.primaryKey, ...cursor.value });
            cursor.continue();
          } else {
            console.log(`[ImageDB] S_GET_IMGS: 조회 완료. 총 ${images.length}개 이미지 발견.`);
            console.groupEnd();
            resolve(images); 
    
      }
        };
        request.onerror = (e) => {
          console.error("[ImageDB] E_GET_IMGS: 이미지 조회 커서 오류.", e.target.error);
          console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_GET_IMGS: 트랜잭션 생성 중 예외 발생.", e);
console.groupEnd();
        reject(e);
      }
    });
  }
  
  async getImageCountForPost(postId) {
    console.log(`[ImageDB] S_COUNT_IMGS: 이미지 카운트 (PostID: ${postId})`);
if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.imageStoreName, 'readonly');
        const store = tx.objectStore(this.imageStoreName);
        const index = store.index('postId');
        const request = index.count(IDBKeyRange.only(postId));

        request.onsuccess = () => {
          console.log(`[ImageDB] S_COUNT_IMGS: 카운트 완료: ${request.result}`);
          resolve(request.result);
   
     };
        request.onerror = (e) => {
          console.error(`[ImageDB] E_COUNT_IMGS: 카운트 실패.`, e.target.error);
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_COUNT_IMGS: 트랜잭션 생성 중 예외 발생.", e);
        reject(e);
      }
    });
}


  async deleteImage(imageId) {
    console.groupCollapsed(`[ImageDB] S_DEL_IMG: 단일 이미지 삭제 (ImageID: ${imageId})`);
    if (!this.db) await this.init();
return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.imageStoreName, 'readwrite');
        const store = tx.objectStore(this.imageStoreName);
        store.delete(imageId); 
        
        tx.oncomplete = () => {
          console.log("[ImageDB] S_DEL_IMG: 삭제 트랜잭션 완료.");
          console.groupEnd();
          resolve();
  
      };
        tx.onerror = (e) => {
          console.error("[ImageDB] E_DEL_IMG: 삭제 트랜잭션 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_DEL_IMG: 트랜잭션 생성 중 예외 발생.", e);
        console.groupEnd();
       
 reject(e);
      }
    });
}
  
  async deleteImagesForPost(postId) {
    console.groupCollapsed(`[ImageDB] S_DEL_POST_IMGS: 게시물 전체 이미지 삭제 (PostID: ${postId})`);
if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.imageStoreName, 'readwrite');
        const store = tx.objectStore(this.imageStoreName);
        const index = store.index('postId');
        const request = index.openKeyCursor(IDBKeyRange.only(postId)); 
        
        let deleteCount = 0;
        request.onsuccess = (e) => {
       
   const cursor = e.target.result;
          if (cursor) {
            store.delete(cursor.primaryKey); 
            deleteCount++;
            cursor.continue();
          } else {
            console.log(`[ImageDB] S_DEL_POST_IMGS: 총 ${deleteCount}개 이미지 키 삭제 요청됨.`);
          }
    
    };
        
        tx.oncomplete = () => {
          console.log("[ImageDB] S_DEL_POST_IMGS: 삭제 트랜잭션 완료.");
          console.groupEnd();
          resolve();
        };
        tx.onerror = (e) => {
          console.error("[ImageDB] E_DEL_POST_IMGS: 삭제 트랜잭션 실패.", e.target.error);
       
   console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_DEL_POST_IMGS: 트랜잭션 생성 중 예외 발생.", e);
console.groupEnd();
        reject(e);
      }
    });
  }
  
  async copyImageToClipboard(blob) {
    console.log("[ImageDB] S_COPY_CLIP: 클립보드 복사 시도...");
try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        console.warn("[ImageDB] W_COPY_CLIP: ClipboardItem API 미지원.");
throw new Error("브라우저가 클립보드 복사를 지원하지 않습니다.");
      }
      const item = new ClipboardItem({ [blob.type]: blob });
await navigator.clipboard.write([item]);
      console.log("[ImageDB] S_COPY_CLIP: 클립보드 복사 성공.");
    } catch (e) {
      console.error("[ImageDB] E_COPY_CLIP: 클립보드 복사 실패.", e);
throw new Error("클립보드 복사 실패. (HTTP 환경에서는 작동하지 않을 수 있습니다)");
}
  }
  
  async saveBGM(file) { // ✨ blob -> file
    console.groupCollapsed(`[ImageDB] S_SAVE_BGM: BGM 저장 시도 (Size: ${file.size})`);
if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.bgmStoreName, 'readwrite');
        const store = tx.objectStore(this.bgmStoreName);
        // ✨ file 객체 (이름 포함)를 저장
        store.put({ id: 'global_bgm', file: file, savedAt: new Date() });
        
        tx.oncomplete = () => {
          console.log("[ImageDB] S_SAVE_BGM: BGM 저장 트랜잭션 완료.");
          
console.groupEnd();
          resolve();
        };
        tx.onerror = (e) => {
          console.error("[ImageDB] E_SAVE_BGM: BGM 저장 트랜잭션 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_SAVE_BGM: 트랜잭션 생성 중 예외 발생.", e);
  
      console.groupEnd();
        reject(e);
      }
    });
}

  async getBGM() {
    console.groupCollapsed("[ImageDB] S_GET_BGM: BGM 조회 시도...");
    if (!this.db) await this.init();
return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.bgmStoreName, 'readonly');
        const store = tx.objectStore(this.bgmStoreName);
        const request = store.get('global_bgm');
        
        request.onsuccess = (e) => {
          const found = e.target.result ? e.target.result.file : null; // ✨ .blob -> .file
          console.log(`[ImageDB] S_GET_BGM: BGM 조회 완료. (찾음: ${!!found})`);
 
         console.groupEnd();
          resolve(found); // ✨ file 객체 또는 null 반환
        };
        request.onerror = (e) => {
          console.error("[ImageDB] E_GET_BGM: BGM 조회 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_GET_BGM: 트랜잭션 생성 중 예외 발생.", e);
        console.groupEnd();
        reject(e);
      }
    });
}

  // --- [신규] 비디오 CRUD ---

  async saveVideo(postId, blob) {
    console.groupCollapsed(`[ImageDB] S_SAVE_VIDEO: 비디오 저장 시도 (PostID: ${postId})`);
console.log(`[ImageDB] S_SAVE_VIDEO: Blob Size: ${blob.size} bytes`);
    
    if (!this.db) await this.init();
return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.videoStoreName, 'readwrite');
        const store = tx.objectStore(this.videoStoreName);
        store.put({ postId: postId, blob: blob, savedAt: new Date() }); // 'put'으로 덮어쓰기
        
        tx.oncomplete = () => {
          console.log("[ImageDB] S_SAVE_VIDEO: 비디오 저장 트랜잭션 완료.");
          console.groupEnd();
 
         resolve();
        };
        tx.onerror = (e) => {
          console.error("[ImageDB] E_SAVE_VIDEO: 비디오 저장 트랜잭션 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error); 
        };
      } catch (e) {
        console.error("[ImageDB] E_SAVE_VIDEO: 트랜잭션 생성 중 예외 발생.", e);
  
      console.groupEnd();
        reject(e); 
      }
    });
}

  async getVideo(postId) {
    console.groupCollapsed(`[ImageDB] S_GET_VIDEO: 비디오 조회 시도 (PostID: ${postId})`);
    if (!this.db) await this.init();
return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.videoStoreName, 'readonly');
        const store = tx.objectStore(this.videoStoreName);
        const request = store.get(postId); // postId가 키
        
        request.onsuccess = (e) => {
          const found = e.target.result ? e.target.result.blob : null;
          console.log(`[ImageDB] S_GET_VIDEO: 비디오 조회 
완료. (찾음: ${!!found})`);
          console.groupEnd();
          resolve(found);
        };
        request.onerror = (e) => {
          console.error("[ImageDB] E_GET_VIDEO: 비디오 조회 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
      
  console.error("[ImageDB] E_GET_VIDEO: 트랜잭션 생성 중 예외 발생.", e);
        console.groupEnd();
        reject(e);
      }
    });
}

  async deleteVideo(postId) {
    console.groupCollapsed(`[ImageDB] S_DEL_VIDEO: 비디오 삭제 시도 (PostID: ${postId})`);
    if (!this.db) await this.init();
return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.videoStoreName, 'readwrite');
        const store = tx.objectStore(this.videoStoreName);
        store.delete(postId); 
        
        tx.oncomplete = () => {
          console.log("[ImageDB] S_DEL_VIDEO: 삭제 트랜잭션 완료.");
          console.groupEnd();
          resolve();
  
      };
        tx.onerror = (e) => {
          console.error("[ImageDB] E_DEL_VIDEO: 삭제 트랜잭션 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_DEL_VIDEO: 트랜잭션 생성 중 예외 발생.", e);
        console.groupEnd();
       
 reject(e);
      }
    });
}

  async deleteBGM() {
    console.groupCollapsed("[ImageDB] S_DEL_BGM: BGM 삭제 시도...");
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.bgmStoreName, 'readwrite');
        const store = tx.objectStore(this.bgmStoreName);
        store.delete('global_bgm');
        
        tx.oncomplete = () => {
          console.log("[ImageDB] S_DEL_BGM: 삭제 트랜잭션 완료.");
          console.groupEnd();
          resolve();
        };
        tx.onerror = (e) => {
          console.error("[ImageDB] E_DEL_BGM: 삭제 트랜잭션 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_DEL_BGM: 트랜잭션 생성 중 예외 발생.", e);
        console.groupEnd();
        reject(e);
      }
    });
  }
  
  // --- [신규] 기본 이미지 CRUD ---

  async addDefaultImage(file) {
    console.groupCollapsed(`[ImageDB] S_ADD_DEFAULT_IMG: 기본 이미지 추가 (Name: ${file.name})`);
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.defaultImageStoreName, 'readwrite');
        const store = tx.objectStore(this.defaultImageStoreName);
        // ✨ File 객체는 blob이므로 File API를 통해 blob으로 저장
        store.add({ name: file.name, type: file.type, blob: file });
        
        tx.oncomplete = () => {
          console.log("[ImageDB] S_ADD_DEFAULT_IMG: 저장 트랜잭션 완료.");
          console.groupEnd();
          resolve();
        };
        tx.onerror = (e) => {
          console.error("[ImageDB] E_ADD_DEFAULT_IMG: 저장 트랜잭션 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error); 
        };
      } catch (e) {
        console.error("[ImageDB] E_ADD_DEFAULT_IMG: 트랜잭션 생성 중 예외 발생.", e);
        console.groupEnd();
        reject(e); 
      }
    });
  }

  async getDefaultImages() {
    console.groupCollapsed("[ImageDB] S_GET_DEFAULT_IMGS: 모든 기본 이미지 조회");
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const images = [];
      try {
        const tx = this.db.transaction(this.defaultImageStoreName, 'readonly');
        const store = tx.objectStore(this.defaultImageStoreName);
        const request = store.openCursor(); 
        
        request.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            images.push({ id: cursor.primaryKey, ...cursor.value });
            cursor.continue();
          } else {
            console.log(`[ImageDB] S_GET_DEFAULT_IMGS: 조회 완료. 총 ${images.length}개.`);
            console.groupEnd();
            resolve(images); 
          }
        };
        request.onerror = (e) => {
          console.error("[ImageDB] E_GET_DEFAULT_IMGS: 조회 커서 오류.", e.target.error);
          console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_GET_DEFAULT_IMGS: 트랜잭션 생성 중 예외 발생.", e);
        console.groupEnd();
        reject(e);
      }
    });
  }

  async deleteDefaultImage(id) {
    console.groupCollapsed(`[ImageDB] S_DEL_DEFAULT_IMG: 기본 이미지 삭제 (ID: ${id})`);
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(this.defaultImageStoreName, 'readwrite');
        const store = tx.objectStore(this.defaultImageStoreName);
        store.delete(id); 
        
        tx.oncomplete = () => {
          console.log("[ImageDB] S_DEL_DEFAULT_IMG: 삭제 트랜잭션 완료.");
          console.groupEnd();
          resolve();
        };
        tx.onerror = (e) => {
          console.error("[ImageDB] E_DEL_DEFAULT_IMG: 삭제 트랜잭션 실패.", e.target.error);
          console.groupEnd();
          reject(e.target.error);
        };
      } catch (e) {
        console.error("[ImageDB] E_DEL_DEFAULT_IMG: 트랜잭션 생성 중 예외 발생.", e);
        console.groupEnd();
        reject(e);
      }
    });
  }
}