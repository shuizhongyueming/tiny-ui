import { type OptionAdjust, adjustTo } from "./utils/adjustTo";
import type { TinyUI, Bitmap, Container, DisplayObject, Rect, Callback } from "@shuizhongyueming/tiny-ui-core";
import { blockInputEvents } from "./utils/blockInputEvents";
import { scaleToSize } from "./utils/scaleToSize";
import { fitSize } from "./utils/fitSize";
import { scaleSize } from "./utils/scaleSize";

export interface ConfirmProps {
  app: TinyUI;
  stageSize: Omit<Rect, 'x' | 'y'>;
  contentSize: Omit<Rect, 'x' | 'y'>;
  imgs: {
    bg: HTMLImageElement;
    contentBg: HTMLImageElement;
    title: HTMLImageElement;
    contents: HTMLImageElement[];
    btnPrev: HTMLImageElement;
    btnNext: HTMLImageElement;
    btnOK: HTMLImageElement;
    btnCancel?: HTMLImageElement;
  };
  onOK?: Callback<ConfirmResult>;
  onCancel?: Callback<ConfirmResult>;
  opt?: {
    titleScale?: number;
    btnScale?: number;
    bgAlpha?: number;
    padding?: number;
  };
}

export interface ConfirmResult {
  container: Container;
  bg: Bitmap;
  contentContainer: Container;
  contentBg: Bitmap;
  title: Bitmap;
  imgContent: Bitmap;
  btnNext: Bitmap;
  btnPrev: Bitmap;
  btnOK?: Bitmap;
  btnCancel?: Bitmap;
  setContents: (contents: string[]) => void;
  adjustToContent: (
    target: DisplayObject,
    adjust: Partial<OptionAdjust>,
    move?: {
      x?: number; // 水平移动
      y?: number; // 垂直移动
    }
  ) => DisplayObject;
  updateContent: () => void;
}

export function Confirm({
  app,
  stageSize,
  contentSize,
  imgs,
  onOK,
  onCancel,
  opt = {},
}: ConfirmProps): ConfirmResult {
  const container = app.createContainer('Confirm/Root');
  const bg = app.createBitmapFromImage(imgs.bg);
  const { bgAlpha = 0.8, padding = 20, titleScale = 1, btnScale = 1 } = opt;

  container.width = stageSize.width;
  container.height = stageSize.height;
  bg.scaleToFit(stageSize.width, stageSize.height);
  bg.alpha = bgAlpha;
  blockInputEvents(bg);
  container.addChild(bg);
  adjustTo(container, true)(bg, { v: 'top', h: 'left' });

  const contentContainer = app.createContainer('Confirm/Content');
  contentContainer.width = contentSize.width;
  contentContainer.height = contentSize.height;
  adjustTo(bg)(contentContainer, { v: 'center', h: 'center' });
  container.addChild(contentContainer);

  const adjustToContent = adjustTo(contentContainer, true);
  const contentBg = app.createBitmapFromImage(imgs.contentBg);
  contentBg.scaleToFit(contentSize.width, contentSize.height);
  adjustToContent(contentBg, { v: 'center', h: 'center' });
  contentContainer.addChild(contentBg);

  const confirmTitle = app.createBitmapFromImage(imgs.title);
  confirmTitle.anchorX = confirmTitle.anchorY = 0.5;
  confirmTitle.scaleX = confirmTitle.scaleY = titleScale;
  adjustToContent(confirmTitle, { v: 'top', h: 'center' }, { y: confirmTitle.height * -0.5 });
  contentContainer.addChild(confirmTitle);

  const imgContent = app.createBitmapFromImage(imgs.contents[0]);
  scaleToSize(
    imgContent,
    fitSize(imgContent.getSize(), scaleSize(contentSize, 0.9))
  );
  adjustToContent(imgContent, { v: 'center', h: 'center' });
  contentContainer.addChild(imgContent);


  const btnNext = app.createBitmapFromImage(imgs.btnNext);
  btnNext.scaleX = btnNext.scaleY = btnScale;
  adjustToContent(btnNext, { v: 'center', h: 'right' }, { x: btnNext.width * 0.5 });
  contentContainer.addChild(btnNext);

  const btnPrev = app.createBitmapFromImage(imgs.btnPrev);
  btnPrev.scaleX = btnPrev.scaleY = btnScale;
  adjustToContent(btnPrev, { v: 'center', h: 'left' }, { x: btnPrev.width * -0.5 });
  contentContainer.addChild(btnPrev);

  const btnOK = app.createBitmapFromImage(imgs.btnOK);
  btnOK.scaleX = btnOK.scaleY = btnScale;
  adjustToContent(
    btnOK,
    { v: 'bottom', h: 'center' },
    { y: btnOK.height * 0.5, x: btnOK.width * 0.5 + padding * 0.5 }
  );
  contentContainer.addChild(btnOK);

  let btnCancel: Bitmap = null;

  if (imgs.btnCancel && onCancel) {
    btnCancel = app.createBitmapFromImage(imgs.btnCancel);
    btnCancel.scaleX = btnCancel.scaleY = btnScale;
    adjustToContent(
      btnCancel,
      { v: 'bottom', h: 'center' },
      { y: btnCancel.height * 0.5, x: btnCancel.width * -0.5 - padding * 0.5 }
    );
    contentContainer.addChild(btnCancel);
  } else {
    adjustToContent(btnOK, { v: 'bottom', h: 'center' }, { y: btnOK.height * 0.5 });
  }

  let pageIndex = 0;
  let contents: string[] = [];
  const updateContent = () => {
    imgContent.src = contents[pageIndex];
    btnNext.visible = pageIndex < contents.length - 1;
    btnPrev.visible = pageIndex > 0;
  };
  btnNext.addEventListener(app.EventName.TouchStart, () => {
    pageIndex = Math.min(pageIndex + 1, contents.length - 1);
    updateContent();
  });
  btnPrev.addEventListener(app.EventName.TouchStart, () => {
    pageIndex = Math.max(pageIndex - 1, 0);
    updateContent();
  });

  const setContents = (urls: string[]) => {
    pageIndex = 0;
    contents = urls;
    updateContent();
  };

  setContents(imgs.contents.map(n => n.src))

  const res: ConfirmResult = {
    container,
    bg,
    contentContainer,
    contentBg,
    title: confirmTitle,
    imgContent,
    btnNext,
    btnPrev,
    btnOK,
    btnCancel,
    setContents,
    adjustToContent,
    updateContent
  }

  btnOK.addEventListener(app.EventName.TouchStart, () => {
    if (onOK) {
      onOK(res);
    } else {
      container.destroy();
    }
  });
  if (btnCancel) {
    btnCancel.addEventListener(app.EventName.TouchStart, () => {
      if (onCancel) {
        onCancel(res);
      } else {
        container.destroy();
      }
    });
  }

  return res;
}
