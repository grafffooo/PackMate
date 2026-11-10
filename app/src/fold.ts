// Fold kinematics: turns the panel tree from the engine into 3D transforms.
// Flat layout coordinates (mm, y down) map to 3D as (x, -y, 0); folds rotate panels toward +z.
import { Matrix4, Vector3 } from "three";
import type { Panel } from "./types";

export const to3 = (p: { x: number; y: number }) => new Vector3(p.x, -p.y, 0);

export type Hinge = { origin: Vector3; axis: Vector3 };

/** Hinge axes oriented so a positive angle lifts the child panel toward +z (in the parent frame). */
export function hinges(panels: Panel[]): (Hinge | null)[] {
  return panels.map((p) => {
    if (!p.hinge) return null;
    const a = to3(p.hinge[0]);
    const b = to3(p.hinge[1]);
    const axis = b.clone().sub(a).normalize();
    const c = centroid(p);
    const v = c.sub(a);
    // z-component of axis × v decides which way +angle swings the panel
    if (axis.x * v.y - axis.y * v.x < 0) axis.negate();
    return { origin: a, axis };
  });
}

export function centroid(p: Panel): Vector3 {
  const c = new Vector3();
  for (const q of p.outline) c.add(to3(q));
  return c.multiplyScalar(1 / Math.max(1, p.outline.length));
}

export function stageCount(panels: Panel[]): number {
  return panels.reduce((m, p) => Math.max(m, p.stage + 1), 1);
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Fold progress (0..1) of one panel for global progress t, folding stages one after another. */
export function stageProgress(
  stage: number,
  stages: number,
  t: number,
): number {
  const local = t * stages - stage;
  return smooth(Math.min(1, Math.max(0, local)));
}

/** World matrices for all panels at global fold progress t (0 = flat, 1 = folded). */
export function foldMatrices(
  panels: Panel[],
  t: number,
  hs = hinges(panels),
): Matrix4[] {
  const stages = stageCount(panels);
  const out: Matrix4[] = [];
  const tmp = new Matrix4();
  panels.forEach((p, i) => {
    const m = new Matrix4();
    const h = hs[i];
    if (p.parent !== null && h) {
      m.copy(out[p.parent]);
      const ang =
        ((p.angle * Math.PI) / 180) * stageProgress(p.stage, stages, t);
      m.multiply(tmp.makeTranslation(h.origin.x, h.origin.y, h.origin.z));
      m.multiply(tmp.makeRotationAxis(h.axis, ang));
      m.multiply(tmp.makeTranslation(-h.origin.x, -h.origin.y, -h.origin.z));
    }
    if (p.assembly?.length) {
      // a separate part (lid, divider): carry it from where it lies flat to its place in the package
      const k = stageProgress(p.stage, stages, t);
      for (const st of p.assembly) {
        const step = new Matrix4();
        if (st.t === "move") {
          step.makeTranslation(st.d[0] * k, -st.d[1] * k, st.d[2] * k);
        } else {
          const pv = new Vector3(st.pivot[0], -st.pivot[1], st.pivot[2]);
          const axis = new Vector3(
            st.axis[0],
            -st.axis[1],
            st.axis[2],
          ).normalize();
          step.makeTranslation(pv.x, pv.y, pv.z);
          step.multiply(
            tmp.makeRotationAxis(axis, ((st.angle * Math.PI) / 180) * k),
          );
          step.multiply(tmp.makeTranslation(-pv.x, -pv.y, -pv.z));
        }
        m.premultiply(step);
      }
    }
    out.push(m);
  });
  return out;
}
