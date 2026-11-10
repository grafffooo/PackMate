import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  BackSide,
  Box3,
  Color,
  SRGBColorSpace,
  RepeatWrapping,
  Texture,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  FrontSide,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { foldMatrices, hinges, type Hinge } from "../fold";
import type { Generated } from "../types";
import type { FaceImages } from "./useTexture";

type Ctx = {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  scene: Scene;
  model: Group;
  holder: Group;
  panels: Group[];
  hinges: (Hinge | null)[];
  floor: Mesh;
  sun: DirectionalLight;
  mats: {
    out: MeshStandardMaterial;
    in: MeshStandardMaterial;
    edge: LineBasicMaterial;
  };
  radius: number;
  render: () => void;
  frame: () => void;
};

/**
 * The folded box on the cutting mat. The canvas is transparent so the mat shows through; a real
 * shadow map from a directional light draws the box's own silhouette onto a shadow-only floor,
 * so the shadow always matches the current fold state.
 */
export function FoldView({
  gen,
  t,
  color,
  images,
  resetKey,
  noWebglText,
}: {
  gen: Generated;
  t: number;
  color: string;
  images?: FaceImages;
  resetKey: string;
  noWebglText: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const ctx = useRef<Ctx | null>(null);
  const [error, setError] = useState(false);
  const framedFor = useRef("");
  const tRef = useRef(t);
  tRef.current = t;
  const genRef = useRef(gen);
  genRef.current = gen;

  useEffect(() => {
    const el = wrap.current!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%";
    el.appendChild(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 1, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    scene.add(new HemisphereLight(0xffffff, 0x8a8a8a, 1.35));
    scene.add(new AmbientLight(0xffffff, 0.3));
    const sun = new DirectionalLight(0xffffff, 1.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 6;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    const fill = new DirectionalLight(0xffffff, 0.45);
    fill.position.set(-0.8, 0.3, -0.6);
    scene.add(fill);
    const floor = new Mesh(
      new PlaneGeometry(1, 1),
      new ShadowMaterial({ color: 0x0b1a18, opacity: 0.32 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const holder = new Group();
    const model = new Group();
    holder.add(model);
    scene.add(holder);
    const mats = {
      out: new MeshStandardMaterial({
        color: 0xc49a6c,
        roughness: 0.85,
        side: BackSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
      }),
      in: new MeshStandardMaterial({
        color: 0xe9dcc6,
        roughness: 0.9,
        side: FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
      }),
      edge: new LineBasicMaterial({
        color: 0x3b2f22,
        transparent: true,
        opacity: 0.4,
      }),
    };
    mats.out.shadowSide = DoubleSide;
    mats.in.shadowSide = DoubleSide;

    let raf = 0;
    const render = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        renderer.render(scene, camera);
      });
    };
    controls.addEventListener("change", render);
    const frame = () => {
      const c = ctx.current;
      if (!c) return;
      const vfov = (camera.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      const dist = (c.radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.12;
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).add(dir.multiplyScalar(dist));
      camera.near = dist / 100;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
      controls.update();
    };
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      frame();
      render();
    });
    ro.observe(el);
    ctx.current = {
      renderer,
      camera,
      controls,
      scene,
      model,
      holder,
      panels: [],
      hinges: [],
      floor,
      sun,
      mats,
      radius: 100,
      render,
      frame,
    };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      ctx.current = null;
    };
  }, []);

  function apply() {
    const c = ctx.current;
    if (!c) return;
    const g = genRef.current;
    const ms = foldMatrices(g.panels, tRef.current, c.hinges);
    c.panels.forEach((grp, i) => {
      grp.matrix.copy(ms[i]);
      grp.matrixWorldNeedsUpdate = true;
    });
    // centre the model on the orbit target, then park the floor under it
    const local = new Box3();
    const v = new Vector3();
    g.panels.forEach((p, i) =>
      p.outline.forEach((q) =>
        local.expandByPoint(v.set(q.x, -q.y, 0).applyMatrix4(ms[i])),
      ),
    );
    const centre = local.getCenter(new Vector3());
    c.model.position.copy(centre.negate());
    c.holder.updateMatrixWorld(true);
    const world = new Box3().setFromObject(c.holder);
    const size = world.getSize(new Vector3());
    c.radius = Math.max(size.length() / 2, 1);
    const r = c.radius;
    c.floor.scale.setScalar(r * 14);
    c.floor.position.set(0, world.min.y - r * 0.004, 0);
    // light from upper left-front; the shadow camera hugs the model so the map stays sharp
    c.sun.position.set(-r * 1.6, r * 3, r * 1.4);
    c.sun.target.position.set(0, world.min.y, 0);
    const sc = c.sun.shadow.camera;
    sc.left = -r * 2.4;
    sc.right = r * 2.4;
    sc.top = r * 2.4;
    sc.bottom = -r * 2.4;
    sc.near = r * 0.5;
    sc.far = r * 8;
    sc.updateProjectionMatrix();
    c.render();
  }

  // rebuild geometry when the dieline changes
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    for (const grp of c.panels) {
      grp.traverse((o) => {
        if (o instanceof Mesh || o instanceof LineSegments)
          o.geometry.dispose();
      });
      c.model.remove(grp);
    }
    c.panels = gen.panels.map((p) => {
      const geo = new ShapeGeometry(
        new Shape(p.outline.map((q) => new Vector2(q.x, -q.y))),
      );
      const grp = new Group();
      grp.matrixAutoUpdate = false;
      const a = new Mesh(geo, c.mats.in);
      const b = new Mesh(geo, c.mats.out);
      for (const m of [a, b]) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      grp.add(a, b, new LineSegments(new EdgesGeometry(geo, 30), c.mats.edge));
      c.model.add(grp);
      return grp;
    });
    c.hinges = hinges(gen.panels);
    // boxes built on a base panel sit flat on the mat; tubes stand as laid out
    c.holder.rotation.set(
      (gen.panels[0]?.name === "Base" || gen.panels.some((p) => p.assembly?.length)) ? -Math.PI / 2 : 0,
      0,
      0,
    );
    // size the bounds from the folded pose so framing doesn't jump while folding
    const folded = tRef.current;
    tRef.current = 1;
    apply();
    tRef.current = folded;
    const radius = c.radius;
    apply();
    c.radius = radius;
    if (framedFor.current !== resetKey) {
      framedFor.current = resetKey;
      c.controls.target.set(0, 0, 0);
      c.camera.position.set(0.7, 0.75, 1.1);
    }
    c.frame();
    c.render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, resetKey]);

  // colour, and the uploaded textures (repeating every 100 mm; the inside falls back to the outside image)
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const made: Texture[] = [];
    const tex = (img?: HTMLImageElement) => {
      if (!img) return null;
      const x = new Texture(img);
      x.colorSpace = SRGBColorSpace;
      x.wrapS = x.wrapT = RepeatWrapping;
      x.repeat.set(0.01, 0.01);
      x.anisotropy = c.renderer.capabilities.getMaxAnisotropy();
      x.needsUpdate = true;
      made.push(x);
      return x;
    };
    const base = new Color(color);
    const out = tex(images?.out);
    const inn = tex(images?.in ?? images?.out);
    c.mats.out.map = out;
    c.mats.in.map = inn;
    c.mats.out.color.copy(out ? new Color(0xffffff) : base);
    c.mats.in.color.copy(
      inn ? new Color(0xffffff) : base.clone().lerp(new Color(0xffffff), 0.35),
    );
    c.mats.out.needsUpdate = true;
    c.mats.in.needsUpdate = true;
    c.render();
    return () => made.forEach((x) => x.dispose());
  }, [color, images?.out, images?.in]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const before = c.radius;
    apply();
    // zoom out when the pose needs it, but never back in while scrubbing: the view stays calm
    if (c.radius > before * 1.001) c.frame();
    else c.radius = before;
    c.floor.scale.setScalar(c.radius * 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  return (
    <>
      <div ref={wrap} style={{ position: "absolute", inset: 0 }} />
      {error && <div className="boot">{noWebglText}</div>}
    </>
  );
}
