declare module 'bidi-js' {
  interface BidiInstance {
    getEmbeddingLevels(text: string): any;
    getReorderedString(text: string, embeddingLevels: any): string;
  }
  function bidiFactory(): BidiInstance;
  export = bidiFactory;
}