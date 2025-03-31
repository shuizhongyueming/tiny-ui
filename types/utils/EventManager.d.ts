import type TinyUI from "../TinyUI";
export declare class EventManager {
    private canvas;
    private app;
    private eventListeners;
    constructor(app: TinyUI);
    private setupEventListeners;
    private createTouchListener;
    private dispatchEventToNode;
    destroy(): void;
}
