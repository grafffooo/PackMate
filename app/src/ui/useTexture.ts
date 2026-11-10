import { useEffect, useState } from "react";
import { useActions } from "../app/context";
import type { Material, TextureRef } from "../storage/model";

/** An object URL for a stored texture, for use in <img> or CSS. */
export function useTextureUrl(ref: TextureRef | undefined): string | null {
  const actions = useActions();
  const [url, setUrl] = useState<string | null>(null);
  const id = ref?.id;
  useEffect(() => {
    if (!id) return setUrl(null);
    let gone = false;
    let made: string | null = null;
    void actions.loadTexture(id).then((t) => {
      if (gone || !t) return;
      made = URL.createObjectURL(
        new Blob([t.data as BlobPart], { type: t.mime }),
      );
      setUrl(made);
    });
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return id ? url : null;
}

export type FaceImages = { out?: HTMLImageElement; in?: HTMLImageElement };

/** Decoded images of a material's textures, for the 3D view. */
export function useMaterialImages(material: Material | undefined): FaceImages {
  const outUrl = useTextureUrl(material?.textures?.out);
  const inUrl = useTextureUrl(material?.textures?.in);
  const [imgs, setImgs] = useState<FaceImages>({});
  useEffect(() => {
    let gone = false;
    const load = (u: string | null) =>
      new Promise<HTMLImageElement | undefined>((res) => {
        if (!u) return res(undefined);
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => res(undefined);
        i.src = u;
      });
    void Promise.all([load(outUrl), load(inUrl)]).then(
      ([o, i]) => !gone && setImgs({ out: o, in: i }),
    );
    return () => {
      gone = true;
    };
  }, [outUrl, inUrl]);
  return imgs;
}
