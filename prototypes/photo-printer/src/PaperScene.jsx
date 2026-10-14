import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// A fixed-view paper mesh. The raster housing is replaced by a GLB in task 2.
export function PaperScene({ imageUrl, progress, taken, onReady, onError }) {
  const host = useRef(null)
  const engine = useRef(null)
  const state = useRef({ progress, taken })
  const callbacks = useRef({ onReady, onError })
  state.current = { progress, taken }
  callbacks.current = { onReady, onError }

  useEffect(() => {
    const container = host.current
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    }
    catch {
      callbacks.current.onError('无法启动相纸预览，请使用支持 WebGL 的浏览器。')
      return
    }
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 5
    const geometry = new THREE.PlaneGeometry(1, 1, 12, 40)
    const positions = geometry.attributes.position
    const original = Float32Array.from(positions.array)
    const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.82, metalness: 0 })
    const paper = new THREE.Mesh(geometry, material)
    scene.add(paper)
    scene.add(new THREE.AmbientLight(0xFFFFFF, 2.0))
    const light = new THREE.DirectionalLight(0xFFFFFF, 1.3)
    light.position.set(-2, 5, 7)
    scene.add(light)
    let texture
    let disposed = false
    const draw = () => {
      const { progress: p, taken: t } = state.current
      paper.visible = p > 0 && t < 1
      const amount = Math.max(0.00001, p)
      for (let i = 0; i < positions.count; i++) {
        const u = original[i * 3] + 0.5
        const v = 0.5 - original[i * 3 + 1]
        const distance = v * amount
        // Coordinates calibrated against the supplied fixed-view housing asset.
        const halfWidth = 0.55 + distance * 0.09
        positions.setXYZ(i, (u * 2 - 1) * halfWidth, 1 - 2 * (0.57 + distance * 0.23 + t * 0.12), Math.sin(Math.PI * Math.min(distance / 0.18, 1)) * 0.023)
        geometry.attributes.uv.setXY(i, u, amount * (1 - v))
      }
      positions.needsUpdate = true
      geometry.attributes.uv.needsUpdate = true
      geometry.computeVertexNormals()
      paper.position.x = t * 0.1
      renderer.render(scene, camera)
    }
    const resize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight, false)
      draw()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    engine.current = { draw }
    const image = new Image()
    image.onload = () => {
      if (disposed) return
      const canvas = document.createElement('canvas')
      canvas.width = 1440
      canvas.height = 960
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#faf9f6'
      ctx.fillRect(0, 0, 1440, 960)
      const scale = Math.min(1380 / image.naturalWidth, 900 / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      ctx.drawImage(image, (1440 - width) / 2, (960 - height) / 2, width, height)
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      material.map = texture
      material.needsUpdate = true
      resize()
      callbacks.current.onReady()
    }
    image.onerror = () => {
      if (!disposed) callbacks.current.onError('照片加载失败，请重新选择图片。')
    }
    image.src = imageUrl
    return () => {
      disposed = true
      observer.disconnect()
      engine.current = null
      texture?.dispose()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [imageUrl])

  useEffect(() => engine.current?.draw(), [progress, taken])
  return <div className="paper-canvas" ref={host} aria-hidden="true" />
}
