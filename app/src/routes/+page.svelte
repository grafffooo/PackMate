<script lang="ts">
  import { onMount } from "svelte";
  import init, { openTraySvg } from "$lib/wasm/packmate_wasm.js";

  let ready = $state(false);
  let length = $state(100);
  let width = $state(60);
  let height = $state(30);

  const result = $derived.by(() => {
    if (!ready) return { svg: "", error: "" };
    try {
      return { svg: openTraySvg(length, width, height), error: "" };
    } catch (e) {
      return { svg: "", error: String(e) };
    }
  });

  onMount(async () => {
    await init();
    ready = true;
  });

  function download() {
    const url = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `open-tray-${length}x${width}x${height}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<main>
  <h1>PackMate</h1>
  <form onsubmit={(e) => e.preventDefault()}>
    <label>Length (mm) <input type="number" min="1" bind:value={length} /></label>
    <label>Width (mm) <input type="number" min="1" bind:value={width} /></label>
    <label>Height (mm) <input type="number" min="1" bind:value={height} /></label>
    <button type="button" onclick={download} disabled={!result.svg}>Download SVG</button>
  </form>
  {#if result.error}<p class="error">{result.error}</p>{/if}
  <div class="preview">{@html result.svg}</div>
</main>

<style>
  main { max-width: 960px; margin: 0 auto; padding: 16px; font-family: system-ui, sans-serif; }
  form { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
  label { display: flex; flex-direction: column; font-size: 0.9rem; }
  input { width: 7rem; padding: 4px; }
  .error { color: #c00; }
  .preview :global(svg) { width: 100%; height: auto; max-height: 70vh; margin-top: 16px; }
</style>
