export interface Point {
  x: number
  y: number
}

export interface Stroke {
  /** Coordinates and brush width in original image pixels. */
  points: Point[]
  brushSize: number
}

export interface Region {
  x1: number
  y1: number
  x2: number
  y2: number
}
