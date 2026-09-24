const report = JSON.parse(document.getElementById('report-data').textContent)
const variants = report.models.flatMap(model => report.modes.map(mode => `${model}:${mode}`))
let selectedVariant = report.defaultVariant
const caseViews = []

function element(tag, className, content) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (content !== undefined) node.textContent = content
  return node
}

function modelLabel(key) {
  return report.modelLabels[key] || key
}
function modeLabel(key) {
  return report.modeLabels[key] || key
}
function variantLabel(key) {
  const [model, mode] = key.split(':')
  return `${modelLabel(model)} · ${modeLabel(mode)}`
}
function number(value, suffix = '') {
  return typeof value === 'number' ? `${value.toFixed(2)}${suffix}` : '—'
}

function openViewer(source, caption) {
  const dialog = document.getElementById('viewer')
  const image = document.getElementById('viewer-image')
  image.src = source
  image.alt = caption
  document.getElementById('viewer-caption').textContent = caption
  dialog.showModal()
}

function imageButton(source, alt, loading = 'lazy') {
  const button = element('button', 'image-button')
  button.type = 'button'
  button.setAttribute('aria-label', `放大查看：${alt}`)
  const image = document.createElement('img')
  image.src = source
  image.alt = alt
  image.loading = loading
  image.decoding = 'async'
  button.append(image)
  button.addEventListener('click', () => openViewer(image.src, image.alt))
  return { button, image }
}

function metric(label, value) {
  const item = element('span', 'metric')
  item.append(`${label} `, element('strong', '', value))
  return item
}

function renderHeader() {
  document.getElementById('report-date').textContent = report.date
  document.getElementById('report-title').textContent = report.title
  document.getElementById('report-subtitle').textContent = report.subtitle
  document.getElementById('method-note').textContent = report.methodNote
  document.getElementById('cost-note').textContent = report.costNote

  const totals = document.getElementById('report-totals')
  for (const [value, label] of [
    [report.sampleCount, '授权照片'],
    [report.resultCount, '编辑请求'],
    [report.successCount, '成功输出'],
  ]) {
    const block = element('div', 'total')
    block.append(element('strong', '', String(value)), element('span', '', label))
    totals.append(block)
  }

  const tbody = document.querySelector('#summary-table tbody')
  for (const row of report.summaries) {
    const tr = document.createElement('tr')
    const values = [
      modelLabel(row.model),
      modeLabel(row.mode),
      `${row.success} / ${row.total}`,
      number(row.latency, ' s'),
      number(row.outsideMae),
      row.catalogCost === null ? '—' : `¥${row.catalogCost.toFixed(2)}`,
    ]
    for (const value of values) tr.append(element('td', '', value))
    tbody.append(tr)
  }

  const findings = document.getElementById('findings')
  for (const finding of report.findings) {
    const node = element('div', 'finding')
    node.append(element('h3', '', finding.label), element('p', '', finding.text))
    findings.append(node)
  }
  if (!report.findings.length) findings.hidden = true
}

function renderControls() {
  const switcher = document.getElementById('variant-switch')
  for (const key of variants) {
    const button = element('button', '', variantLabel(key))
    button.type = 'button'
    button.dataset.variant = key
    button.setAttribute('aria-pressed', String(key === selectedVariant))
    button.addEventListener('click', () => selectVariant(key))
    switcher.append(button)
  }
  const filter = document.getElementById('type-filter')
  const types = [...new Map(report.cases.map(item => [item.type, item.typeLabel])).entries()]
  for (const [type, label] of types) {
    const option = element('option', '', label)
    option.value = type
    filter.append(option)
  }
  filter.addEventListener('change', () => {
    for (const view of caseViews) view.node.hidden = filter.value !== 'all' && view.data.type !== filter.value
  })
}

function renderDetail(caseData, container) {
  const entries = [{ label: '干净参照', image: caseData.clean }]
  for (const key of variants) {
    entries.push({ label: variantLabel(key), image: caseData.variants[key]?.image })
  }
  for (const entry of entries) {
    const figure = document.createElement('figure')
    if (entry.image) {
      figure.append(imageButton(entry.image, `${caseData.id} · ${entry.label}`).button)
    }
    else {
      figure.append(element('div', 'missing', '无输出'))
    }
    figure.append(element('figcaption', 'image-label', entry.label))
    container.append(figure)
  }
}

function renderCases() {
  const list = document.getElementById('case-list')
  for (const caseData of report.cases) {
    const section = element('section', 'case')
    section.id = `sample-${caseData.id}`
    section.dataset.type = caseData.type
    const aside = element('div', 'case-meta')
    aside.append(element('span', 'case-number', `NO. ${caseData.id}`))
    aside.append(element('span', 'case-type', caseData.type.toUpperCase().replaceAll('_', ' ')))
    aside.append(element('h3', '', caseData.typeLabel))
    const source = element('div', 'case-source')
    source.append(element('span', '', `${caseData.license} · 来源：`))
    const sourceLink = element('a', '', caseData.sourceTitle.replace(/^File:/, ''))
    sourceLink.href = caseData.sourcePage
    sourceLink.target = '_blank'
    sourceLink.rel = 'noopener noreferrer'
    source.append(sourceLink)
    aside.append(source)
    if (caseData.note) aside.append(element('p', 'case-note', caseData.note))

    const content = element('div', 'case-content')
    const pair = element('div', 'pair')
    const before = document.createElement('figure')
    before.append(imageButton(caseData.before, `${caseData.id} · 去水印前`).button)
    const beforeCaption = element('figcaption', 'image-label')
    beforeCaption.append(element('span', '', '输入 / 有水印'), element('span', '', '点击放大'))
    before.append(beforeCaption)
    const after = document.createElement('figure')
    const afterButton = imageButton(caseData.before, `${caseData.id} · 去水印后`)
    after.append(afterButton.button)
    const missing = element('div', 'missing', '本条件无成功输出')
    missing.hidden = true
    after.append(missing)
    const afterCaption = element('figcaption', 'image-label')
    afterCaption.append(element('span', '', '输出'), element('span', '', ''))
    after.append(afterCaption)
    pair.append(before, after)
    content.append(pair)
    const metrics = element('div', 'metrics')
    content.append(metrics)

    const details = element('details', 'case-details')
    details.append(element('summary', '', '查看干净参照与全部结果'))
    const grid = element('div', 'detail-grid')
    details.append(grid)
    details.addEventListener('toggle', () => {
      if (details.open && !grid.childElementCount) renderDetail(caseData, grid)
    })
    content.append(details)
    section.append(aside, content)
    list.append(section)
    caseViews.push({ node: section, data: caseData, image: afterButton.image, button: afterButton.button, missing, caption: afterCaption.lastChild, metrics })
  }
  selectVariant(selectedVariant)
}

function selectVariant(key) {
  selectedVariant = key
  for (const button of document.querySelectorAll('#variant-switch button')) {
    button.setAttribute('aria-pressed', String(button.dataset.variant === key))
  }
  for (const view of caseViews) {
    const row = view.data.variants[key]
    const hasImage = Boolean(row?.image)
    view.button.hidden = !hasImage
    view.missing.hidden = hasImage
    if (hasImage) {
      view.image.src = row.image
      view.image.alt = `${view.data.id} · ${variantLabel(key)} 去水印结果`
    }
    view.caption.textContent = variantLabel(key)
    view.metrics.replaceChildren()
    if (row) {
      view.metrics.append(
        metric('状态', ({ succeeded: '成功', failed: '失败', unknown: '待核对' })[row.status] || row.status || '未记录'),
        metric('耗时', number(row.latency_seconds, ' s')),
        metric('框外差', number(row.outside_mae)),
        metric('目标区改善', typeof row.target_improvement === 'number'
          ? `${Math.round(row.target_improvement * 100)}%`
          : '—'),
      )
      if (row.error) view.metrics.append(metric('原因', row.error))
    }
  }
}

document.getElementById('viewer-close').addEventListener('click', () => document.getElementById('viewer').close())
document.getElementById('viewer').addEventListener('click', (event) => {
  if (event.target.id === 'viewer') event.target.close()
})
document.addEventListener('keydown', (event) => {
  if (document.getElementById('viewer').open || ['SELECT', 'INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const offset = event.key === 'ArrowRight' ? 1 : -1
  selectVariant(variants[(variants.indexOf(selectedVariant) + offset + variants.length) % variants.length])
})

renderHeader()
renderControls()
renderCases()
