import { Buffer } from 'node:buffer'
import { BadGatewayException, BadRequestException, GatewayTimeoutException } from '@nestjs/common'
import { WatermarkService } from './watermark.service'

const input = `data:image/png;base64,${Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')}`
const output = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')

describe('watermarkService', () => {
  const service = new WatermarkService()
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    process.env.ARK_API_KEY = 'test-key'
    process.env.ARK_SEEDREAM_LITE_ENDPOINT = 'ep-lite'
    process.env.ARK_SEEDREAM_FLASH_ENDPOINT = 'ep-flash'
    fetchSpy = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    delete process.env.ARK_API_KEY
    delete process.env.ARK_SEEDREAM_LITE_ENDPOINT
    delete process.env.ARK_SEEDREAM_FLASH_ENDPOINT
  })

  it.each([
    ['lite', 'direct', 'ep-lite'],
    ['flash', 'region', 'ep-flash'],
  ] as const)('selects %s for %s mode and returns a PNG data URI', async (model, mode, endpoint) => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ data: [{ b64_json: output }] }) })

    const result = await service.removeWatermark({
      image: input,
      model,
      mode,
      ...(mode === 'region' ? { region: { x1: 10, y1: 20, x2: 30, y2: 40 } } : {}),
    })

    expect(result).toEqual({ image: `data:image/png;base64,${output}`, model })
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://ark.cn-beijing.volces.com/api/v3/images/generations')
    expect(options.headers.authorization).toBe('Bearer test-key')
    expect(JSON.parse(options.body)).toMatchObject({
      model: endpoint,
      image: input,
      size: '2K',
      output_format: 'png',
      response_format: 'b64_json',
      watermark: false,
    })
    expect(JSON.parse(options.body).prompt).toContain(mode === 'region' ? '<bbox>10 20 30 40</bbox>' : '请仅移除图片中')
  })

  it('rejects invalid coordinates before calling Ark', async () => {
    await expect(service.removeWatermark({
      image: input,
      model: 'lite',
      mode: 'region',
      region: { x1: 30, y1: 20, x2: 10, y2: 40 },
    })).rejects.toBeInstanceOf(BadRequestException)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reports upstream authentication failures without exposing the response body', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401 })
    await expect(service.removeWatermark({ image: input, model: 'lite', mode: 'direct' }))
      .rejects
      .toBeInstanceOf(BadGatewayException)
  })

  it('reports timeouts separately from other upstream failures', async () => {
    fetchSpy.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
    await expect(service.removeWatermark({ image: input, model: 'lite', mode: 'direct' }))
      .rejects
      .toBeInstanceOf(GatewayTimeoutException)
  })

  it('rejects responses without an image', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    await expect(service.removeWatermark({ image: input, model: 'lite', mode: 'direct' }))
      .rejects
      .toBeInstanceOf(BadGatewayException)
  })
})
