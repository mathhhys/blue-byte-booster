declare global {
  interface Window {
    rdt: (event: string, ...args: any[]) => void;
  }
}

export {};