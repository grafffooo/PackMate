import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  BackSide,
  Box3,
  DirectionalLight,
  EdgesGeometry,
  FrontSide,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { foldMatrices, hinges, type Hinge } from "./fold";
import type { Generated } from "./types";
import { Play } from "./icons";

type Finish = "kraft" | "white";
const FINISH: Record<Finish, { out: number; in: number }> = {
  kraft: { out: 0xc49a6c, in: 0xe9dcc6 },
  white: { out: 0xf7f5f0, in: 0xe6e2da },
};

type Props = { gen: Generated; resetKey: string };

type Ctx = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  model: Group;
  holder: Group;
  panels: Group[];
  hinges: (Hinge | null)[];
  mats: { out: MeshStandardMaterial; in: MeshStandardMaterial; edge: LineBasicMaterial };
  render: () => void;
  radius: number;
  frame: () => void;
};

export function FoldView({ gen, resetKey }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const ctx = useRef<Ctx | null>(null);
  const [t, setT] = useState(1);
  const [finish, setFinish] = useState<Finish>("kraft");
  const [error, setError] = useState<string | null>(null);
  const anim = useRef<number | null>(null);
  const framedFor = useRef<string>("");

  // --- one-time three.js setup ---
  useEffect(() => {
    const el = wrap.current!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      setError("3D preview needs WebGL, which isn't available here.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = "fold-canvas";
    el.appendChild(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 1, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    scene.add(new HemisphereLight(0xffffff, 0x8a7a66, 1.6));
    scene.add(new AmbientLight(0xffffff, 0.35));
    const sun = new DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.6, 1, 0.8);
    scene.add(sun);
    const back = new DirectionalLight(0xffffff, 0.5);
    back.position.set(-0.8, -0.3, -0.6);
    scene.add(back);
    const holder = new Group();
    const model = new Group();
    holder.add(model);
    scene.add(holder);
    const mats = {
      out: new MeshStandardMaterial({ color: FINISH.kraft.out, roughness: 0.85, side: BackSide, polygonOffset: true, polygonOffsetFactor: 1 }),
      in: new MeshStandardMaterial({ color: FINISH.kraft.in, roughness: 0.9, side: FrontSide, polygonOffset: true, polygonOffsetFactor: 1 }),
      edge: new LineBasicMaterial({ color: 0x3b2f22, transparent: true, opacity: 0.45 }),
    };
    let raf = 0;
    const render = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        renderer.render(scene, camera);
      });
    };
    controls.addEventListener("change", render);
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      ctx.current?.frame();
      render();
    });
    ro.observe(el);
    const frame = () => {
      const c = ctx.current;
      if (!c) return;
      // fit the bounding sphere into the narrower of the two fields of view
      const vfov = (camera.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      const dist = (c.radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.08;
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).add(dir.multiplyScalar(dist));
      camera.near = dist / 100;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
      controls.update();
    };
    ctx.current = { renderer, scene, camera, controls, model, holder, panels: [], hinges: [], mats, render, radius: 100, frame };
    return () => {
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      ctx.current = null;
    };
  }, []);

  // --- rebuild geometry when the dieline changes ---
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    for (const g of c.panels) {
      g.traverse((o) => {
        if (o instanceof Mesh || o instanceof LineSegments) o.geometry.dispose();
      });
      c.model.remove(g);
    }
    c.panels = gen.panels.map((p) => {
      const shape = new Shape(p.outline.map((q) => new Vector2(q.x, -q.y)));
      const geo = new ShapeGeometry(shape);
      const g = new Group();
      g.matrixAutoUpdate = false;
      g.add(new Mesh(geo, c.mats.in));
      g.add(new Mesh(geo, c.mats.out));
      g.add(new LineSegments(new EdgesGeometry(geo, 30), c.mats.edge));
      c.model.add(g);
      return g;
    });
    c.hinges = hinges(gen.panels);
    // boxes built on a base panel sit flat; tubes stand upright as laid out
    const flat = gen.panels[0]?.name === "Base";
    c.holder.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
    apply(t);
    // frame the folded model
    const size = new Vector3();
    const box = bounds(c, 1);
    box.getSize(size);
    c.radius = Math.max(size.length() / 2, 1);
    if (framedFor.current !== resetKey) {
      framedFor.current = resetKey;
      c.controls.target.set(0, 0, 0);
      c.camera.position.set(0.75, 0.55, 1.15);
    }
    c.frame();
    c.render();
  }, [gen]);

  function bounds(c: Ctx, at: number): Box3 {
    const ms = foldMatrices(gen.panels, at, c.hinges);
    const box = new Box3();
    const v = new Vector3();
    gen.panels.forEach((p, i) => {
      for (const q of p.outline) box.expandByPoint(v.set(q.x, -q.y, 0).applyMatrix4(ms[i]));
    });
    return box; // a 90° holder rotation only swaps axes, so the diagonal is unchanged
  }

  function apply(at: number) {
    const c = ctx.current;
    if (!c) return;
    const ms = foldMatrices(gen.panels, at, c.hinges);
    c.panels.forEach((g, i) => {
      g.matrix.copy(ms[i]);
      g.matrixWorldNeedsUpdate = true;
    });
    // keep the model centred on the orbit target
    const center = new Vector3();
    const local = new Box3();
    const v = new Vector3();
    gen.panels.forEach((p, i) => {
      for (const q of p.outline) local.expandByPoint(v.set(q.x, -q.y, 0).applyMatrix4(ms[i]));
    });
    local.getCenter(center);
    c.model.position.copy(center.negate());
    c.render();
  }

  useEffect(() => {
    apply(t);
  }, [t]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.mats.out.color.setHex(FINISH[finish].out);
    c.mats.in.color.setHex(FINISH[finish].in);
    c.render();
  }, [finish]);

  const play = () => {
    if (anim.current) cancelAnimationFrame(anim.current);
    const start = performance.now();
    const dur = 2600;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      setT(k);
      anim.current = k < 1 ? requestAnimationFrame(tick) : null;
    };
    anim.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => {
    if (anim.current) cancelAnimationFrame(anim.current);
  }, []);

  return (
    <>
      <div ref={wrap} style={{ position: "absolute", inset: 0 }} />
      {error && <div className="loading">{error}</div>}
      <div className="view-tools">
        <div className="pill">
          <button className="btn small ghost icon-btn" onClick={play} title="Play fold animation" aria-label="Play fold animation">
            <Play />
          </button>
          <span>Flat</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={t}
            aria-label="Fold amount"
            onChange={(e) => {
              if (anim.current) cancelAnimationFrame(anim.current);
              anim.current = null;
              setT(parseFloat(e.target.value));
            }}
          />
          <span>Folded</span>
        </div>
        <div className="seg">
          {(["kraft", "white"] as Finish[]).map((f) => (
            <button key={f} aria-pressed={finish === f} onClick={() => setFinish(f)}>
              {f === "kraft" ? "Kraft" : "White"}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
