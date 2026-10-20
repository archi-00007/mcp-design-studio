import type { SchemaField, ServerDoc, Tool, ToolAnnotations } from './types'

let seq = 0
const fid = () => `f${++seq}`

function f(
  name: string,
  type: SchemaField['type'],
  required: boolean,
  description: string,
  enumValues: string[] = [],
  children: SchemaField[] = [],
): SchemaField {
  return { id: fid(), name, title: '', type, required, description, enumValues, children }
}

/** 嵌套对象 */
function obj(
  name: string,
  required: boolean,
  description: string,
  children: SchemaField[],
): SchemaField {
  return { id: fid(), name, title: '', type: 'object', required, description, enumValues: [], children }
}

/** 数组字段，items 的元素结构由 itemsChildren 描述 */
function arr(
  name: string,
  required: boolean,
  description: string,
  itemsType: SchemaField['type'],
  itemsChildren: SchemaField[] = [],
  enumValues: string[] = [],
): SchemaField {
  return {
    id: fid(),
    name,
    title: '',
    type: 'array',
    required,
    description,
    enumValues,
    children: [
      {
        id: fid(),
        name: '',
        title: '',
        type: itemsType,
        required: false,
        description: '',
        enumValues: [],
        children: itemsChildren,
        isItems: true,
      },
    ],
  }
}

const RO: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}

const WRITE_IDEMPOTENT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
}

/**
 * 种子数据里只写了日期。表格要精确到时分秒，这里补一个稳定的时刻——
 * 用递增序号推算出 09:00–17:00 之间的不同时间，而不是让所有工具都停在 00:00:00。
 */
let clock = 0
function stamp(date: string): string {
  if (date.includes(':')) return date
  clock += 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date} ${pad(9 + ((clock * 3) % 8))}:${pad((clock * 17) % 60)}:${pad((clock * 7) % 60)}`
}

function tool(
  id: string,
  name: string,
  title: string,
  description: string,
  input: SchemaField[],
  output: SchemaField[],
  annotations: ToolAnnotations,
  createdAt: string,
  updatedAt: string,
): Tool {
  return {
    id,
    name,
    title,
    description,
    // 种子数据只演示协议内的内容；内部说明是给实现看的，留空由使用者自己写
    internalNotes: '',
    input,
    output,
    requestExamples: [],
    responseExamples: [],
    annotations,
    createdAt: stamp(createdAt),
    updatedAt: stamp(updatedAt),
  }
}

/**
 * 种子数据的中文名。按「工具.字段名」写，同一工具内出现同名但含义不同时
 * 用「工具.入参/出参.字段名」消歧（如 list_orders 的 status）。
 */
const TITLES: Record<string, string> = {
  // get_order
  'get_order.order_id': '订单号',
  'get_order.with_items': '是否含明细',
  'get_order.status': '履约状态',
  'get_order.amount': '订单金额',
  'get_order.customer': '下单客户',
  'get_order.customer_id': '客户编号',
  'get_order.name': '客户姓名',
  'get_order.phone': '联系电话',
  'get_order.address': '收货地址',
  'get_order.province': '省份',
  'get_order.city': '城市',
  'get_order.detail': '详细地址',
  'get_order.items': '商品明细',
  'get_order.sku': '商品SKU',
  'get_order.title': '商品标题',
  'get_order.quantity': '购买数量',
  'get_order.price': '单价',

  // list_orders
  'list_orders.input.status': '筛选状态',
  'list_orders.output.status': '履约状态',
  'list_orders.start_date': '开始日期',
  'list_orders.end_date': '结束日期',
  'list_orders.limit': '条数上限',
  'list_orders.items': '订单列表',
  'list_orders.order_id': '订单号',
  'list_orders.amount': '实付金额',
  'list_orders.created_at': '创建时间',
  'list_orders.next_cursor': '下一页游标',

  // create_order
  'create_order.customer_id': '客户编号',
  'create_order.items': '商品行',
  'create_order.sku': '商品SKU',
  'create_order.quantity': '数量',
  'create_order.remark': '订单备注',
  'create_order.order_id': '订单号',
  'create_order.created_at': '创建时间',

  // cancel_order
  'cancel_order.order_id': '订单号',
  'cancel_order.reason': '取消原因',
  'cancel_order.status': '取消后状态',

  // update_order_status
  'update_order_status.order_id': '订单号',
  'update_order_status.input.status': '目标状态',
  'update_order_status.output.status': '更新后状态',
  'update_order_status.reason': '变更原因',
  'update_order_status.updated_at': '更新时间',

  // refund_order
  'refund_order.order_id': '订单号',
  'refund_order.amount': '退款金额',
  'refund_order.reason': '退款原因',
  'refund_order.refund_id': '退款单号',
  'refund_order.status': '退款状态',

  // get_shipment
  'get_shipment.tracking_no': '运单号',
  'get_shipment.carrier': '承运商',
  'get_shipment.events': '轨迹节点',
  'get_shipment.time': '节点时间',
  'get_shipment.status': '节点状态',
  'get_shipment.location': '所在城市',
  'get_shipment.delivered': '已签收',

  // create_shipment
  'create_shipment.order_id': '订单号',
  'create_shipment.carrier': '承运商',
  'create_shipment.warehouse_id': '发货仓',
  'create_shipment.tracking_no': '运单号',
  'create_shipment.shipped_at': '发货时间',

  // list_products
  'list_products.keyword': '关键词',
  'list_products.category': '类目',
  'list_products.limit': '条数上限',
  'list_products.items': '商品列表',
  'list_products.sku': '商品SKU',
  'list_products.title': '商品标题',
  'list_products.price': '售价',
  'list_products.stock': '可售库存',
  'list_products.total': '命中总数',

  // get_product
  'get_product.sku': '商品SKU',
  'get_product.title': '商品标题',
  'get_product.price': '售价',
  'get_product.stock': '可售库存',

  // update_stock
  'update_stock.sku': '商品SKU',
  'update_stock.delta': '库存增量',
  'update_stock.mode': '计算方式',
  'update_stock.stock': '更新后库存',

  // get_customer
  'get_customer.customer_id': '客户编号',
  'get_customer.name': '客户姓名',
  'get_customer.total_spent': '累计消费',

  // list_customers
  'list_customers.tag': '客户标签',
  'list_customers.limit': '条数上限',
  'list_customers.items': '客户列表',
  'list_customers.customer_id': '客户编号',
  'list_customers.name': '客户姓名',
  'list_customers.total_spent': '累计消费',
  'list_customers.total': '命中总数',

  // create_ticket
  'create_ticket.order_id': '关联订单',
  'create_ticket.type': '工单类型',
  'create_ticket.description': '问题描述',
  'create_ticket.ticket_id': '工单号',
  'create_ticket.status': '工单状态',

  // get_ticket
  'get_ticket.ticket_id': '工单号',
  'get_ticket.status': '工单状态',
  'get_ticket.assignee': '处理人',

  // close_ticket
  'close_ticket.ticket_id': '工单号',
  'close_ticket.resolution': '结案说明',
  'close_ticket.status': '关闭后状态',

  // get_invoice
  'get_invoice.order_id': '订单号',
  'get_invoice.invoice_no': '发票号码',
  'get_invoice.title': '发票抬头',
  'get_invoice.issued': '已开票',

  // export_report
  'export_report.start_date': '开始日期',
  'export_report.end_date': '结束日期',
  'export_report.format': '导出格式',
  'export_report.download_url': '下载链接',
  'export_report.expires_at': '链接过期',
}

function titleize(fields: SchemaField[], lookup: (name: string) => string): SchemaField[] {
  return fields.map((field) => ({
    ...field,
    title: field.isItems ? '' : lookup(field.name),
    children: titleize(field.children, lookup),
  }))
}

function applyTitles(tools: Tool[]): Tool[] {
  return tools.map((tool) => {
    const lookup = (section: 'input' | 'output') => (name: string) =>
      TITLES[`${tool.name}.${section}.${name}`] ?? TITLES[`${tool.name}.${name}`] ?? ''
    return {
      ...tool,
      input: titleize(tool.input, lookup('input')),
      output: titleize(tool.output, lookup('output')),
    }
  })
}

/**
 * 给样例工具配的一份示例，让新打开的人一眼看到「请求示例 / 响应示例」是什么形态。
 * 示例是写作者要自己补的内容，所以只点缀这一处，其余工具留空。
 */
const SEED_EXAMPLES: Record<string, { request: string[]; response: string[] }> = {
  't-get-order': {
    request: [
      JSON.stringify({ order_id: 'SO-2026-000123', with_items: true }, null, 2),
    ],
    response: [
      JSON.stringify(
        {
          order_id: 'SO-2026-000123',
          status: 'shipped',
          amount: 259.0,
          customer: {
            customer_id: 'C-88213',
            name: '张伟',
            phone: '13800001234',
            address: { province: '浙江省', city: '杭州市', detail: '西湖区文三路 388 号 2 幢 501' },
          },
          items: [{ sku: 'SKU-1001', title: '清爽氨基酸洁面 120g', quantity: 2, price: 129.5 }],
        },
        null,
        2,
      ),
    ],
  },
}

function applyExamples(tools: Tool[]): Tool[] {
  return tools.map((tool) => {
    const seed = SEED_EXAMPLES[tool.id]
    return seed ? { ...tool, requestExamples: [...seed.request], responseExamples: [...seed.response] } : tool
  })
}

export const SEED_TOOLS: Tool[] = applyExamples(applyTitles([
  tool(
    't-get-order',
    'get_order',
    '查询订单详情',
    '按订单号返回单笔订单的完整信息，包含商品明细、金额构成与当前履约状态。',
    [
      f('order_id', 'string', true, '订单号，形如 SO-2026-000123'),
      f('with_items', 'boolean', false, '是否附带商品明细，默认 true'),
    ],
    [
      f('order_id', 'string', true, '订单号'),
      f('status', 'string', true, '履约状态', ['pending', 'paid', 'shipped', 'closed']),
      f('amount', 'number', true, '订单实付金额（元）'),
      obj('customer', true, '下单客户', [
        f('customer_id', 'string', true, '客户编号'),
        f('name', 'string', true, '客户姓名'),
        f('phone', 'string', false, '联系电话'),
        obj('address', false, '收货地址', [
          f('province', 'string', true, '省份'),
          f('city', 'string', true, '城市'),
          f('detail', 'string', true, '详细地址，含街道与门牌'),
        ]),
      ]),
      arr('items', true, '商品明细', 'object', [
        f('sku', 'string', true, '商品 SKU'),
        f('title', 'string', true, '商品标题'),
        f('quantity', 'integer', true, '购买数量'),
        f('price', 'number', true, '单价（元）'),
      ]),
    ],
    RO,
    '2026-09-18',
    '2026-10-16',
  ),
  tool(
    't-list-orders',
    'list_orders',
    '批量查询订单',
    '按时间区间与状态筛选订单，游标分页返回，单次最多 100 条。',
    [
      f('status', 'string', false, '履约状态筛选', ['pending', 'paid', 'shipped', 'closed']),
      f('start_date', 'string', false, '起始日期，格式 YYYY-MM-DD'),
      f('end_date', 'string', false, '结束日期，格式 YYYY-MM-DD'),
      f('limit', 'integer', false, '返回条数上限，默认 20'),
    ],
    [
      arr('items', true, '订单列表', 'object', [
        f('order_id', 'string', true, '订单号'),
        f('status', 'string', true, '履约状态', ['pending', 'paid', 'shipped', 'closed']),
        f('amount', 'number', true, '实付金额（元）'),
        f('created_at', 'string', true, '创建时间，ISO 8601'),
      ]),
      f('next_cursor', 'string', false, '下一页游标，无更多时为 null'),
    ],
    RO,
    '2026-09-18',
    '2026-10-15',
  ),
  tool(
    't-create-order',
    'create_order',
    '创建订单',
    '依据客户与商品行创建订单，返回系统生成的订单号。',
    [
      f('customer_id', 'string', true, '客户编号'),
      arr('items', true, '商品行，至少一行', 'object', [
        f('sku', 'string', true, '商品 SKU'),
        f('quantity', 'integer', true, '数量，必须为正整数'),
      ]),
      f('remark', 'string', false, '订单备注'),
    ],
    [f('order_id', 'string', true, '订单号'), f('created_at', 'string', true, '创建时间')],
    WRITE,
    '2026-09-19',
    '2026-10-14',
  ),
  tool(
    't-cancel-order',
    'cancel_order',
    '取消订单',
    '取消未发货订单并释放库存，已发货订单需先走退货流程。',
    [
      f('order_id', 'string', true, '订单号'),
      f('reason', 'string', true, '取消原因，写入订单操作日志'),
    ],
    [f('order_id', 'string', true, '订单号'), f('status', 'string', true, '取消后状态')],
    DESTRUCTIVE,
    '2026-09-19',
    '2026-10-12',
  ),
  tool(
    't-update-order-status',
    'update_order_status',
    '更新订单状态',
    '按订单号更新履约状态，仅允许在待付款、已付款、已发货、已关闭之间流转，越级流转会被拒绝。',
    [
      f('order_id', 'string', true, '订单号，形如 SO-2026-000123'),
      f('status', 'string', true, '目标履约状态', ['pending', 'paid', 'shipped', 'closed']),
      f('reason', 'string', false, '变更原因，写入状态流转记录'),
    ],
    [
      f('order_id', 'string', true, '订单号'),
      f('status', 'string', true, '更新后的履约状态'),
      f('updated_at', 'string', true, '更新时间'),
    ],
    WRITE_IDEMPOTENT,
    '2026-09-20',
    '2026-10-16',
  ),
  tool(
    't-refund-order',
    'refund_order',
    '订单退款',
    '对已支付订单发起全额或部分退款，退款单号异步回写。',
    [
      f('order_id', 'string', true, '订单号'),
      f('amount', 'number', true, '退款金额（元），不得超过实付金额'),
      f('reason', 'string', true, '退款原因'),
    ],
    [f('refund_id', 'string', true, '退款单号'), f('status', 'string', true, '退款处理状态')],
    DESTRUCTIVE,
    '2026-09-21',
    '2026-10-11',
  ),
  tool(
    't-get-shipment',
    'get_shipment',
    '查询物流轨迹',
    '按运单号查询承运商轨迹节点，返回签收状态与最新一条物流记录。',
    [f('tracking_no', 'string', true, '运单号'), f('carrier', 'string', false, '承运商编码')],
    [
      f('tracking_no', 'string', true, '运单号'),
      arr('events', true, '轨迹节点，按时间倒序', 'object', [
        f('time', 'string', true, '节点时间，ISO 8601'),
        f('status', 'string', true, '节点状态'),
        f('location', 'string', false, '所在城市'),
      ]),
      f('delivered', 'boolean', true, '是否已签收'),
    ],
    RO,
    '2026-09-22',
    '2026-10-13',
  ),
  tool(
    't-create-shipment',
    'create_shipment',
    '创建发货单',
    '为已付款订单生成发货单并分配运单号，重复调用会返回既有运单号。',
    [
      f('order_id', 'string', true, '订单号'),
      f('carrier', 'string', true, '承运商编码', ['sf', 'jd', 'yto', 'zto']),
      f('warehouse_id', 'string', true, '发货仓编号'),
    ],
    [f('tracking_no', 'string', true, '运单号'), f('shipped_at', 'string', true, '发货时间')],
    WRITE_IDEMPOTENT,
    '2026-09-22',
    '2026-10-10',
  ),
  tool(
    't-list-products',
    'list_products',
    '商品列表查询',
    '按类目、关键词与在售状态筛选商品，返回分页结果。',
    [
      f('keyword', 'string', false, '标题关键词模糊匹配'),
      f('category', 'string', false, '类目编码'),
      f('limit', 'integer', false, '返回条数上限，默认 20'),
    ],
    [
      arr('items', true, '商品列表', 'object', [
        f('sku', 'string', true, '商品 SKU'),
        f('title', 'string', true, '商品标题'),
        f('price', 'number', true, '售价（元）'),
        f('stock', 'integer', true, '可售库存'),
      ]),
      f('total', 'integer', true, '命中总数'),
    ],
    RO,
    '2026-09-23',
    '2026-10-09',
  ),
  tool(
    't-get-product',
    'get_product',
    '商品详情查询',
    '按 SKU 返回商品标题、价格、库存与属性组合。',
    [f('sku', 'string', true, '商品 SKU 编码')],
    [
      f('sku', 'string', true, '商品 SKU'),
      f('title', 'string', true, '商品标题'),
      f('price', 'number', true, '当前售价（元）'),
      f('stock', 'integer', true, '可售库存'),
    ],
    RO,
    '2026-09-23',
    '2026-10-08',
  ),
  tool(
    't-update-stock',
    'update_stock',
    '更新商品库存',
    '按 SKU 覆盖或增减可售库存，返回更新后的库存快照。',
    [
      f('sku', 'string', true, '商品 SKU 编码'),
      f('delta', 'integer', true, '库存增量，可为负数'),
      f('mode', 'string', false, '计算方式', ['increment', 'override']),
    ],
    [f('sku', 'string', true, '商品 SKU'), f('stock', 'integer', true, '更新后库存')],
    WRITE_IDEMPOTENT,
    '2026-09-24',
    '2026-10-07',
  ),
  tool(
    't-get-customer',
    'get_customer',
    '查询客户资料',
    '按客户编号返回基础资料与累计消费金额。',
    [f('customer_id', 'string', true, '客户编号')],
    [
      f('customer_id', 'string', true, '客户编号'),
      f('name', 'string', true, '客户姓名'),
      f('total_spent', 'number', true, '累计消费金额（元）'),
    ],
    RO,
    '2026-09-24',
    '2026-10-06',
  ),
  tool(
    't-list-customers',
    'list_customers',
    '客户列表查询',
    '按注册时间与标签筛选客户，返回分页结果。',
    [
      f('tag', 'string', false, '客户标签'),
      f('limit', 'integer', false, '返回条数上限，默认 20'),
    ],
    [
      arr('items', true, '客户列表', 'object', [
        f('customer_id', 'string', true, '客户编号'),
        f('name', 'string', true, '客户姓名'),
        f('total_spent', 'number', true, '累计消费金额（元）'),
      ]),
      f('total', 'integer', true, '命中总数'),
    ],
    RO,
    '2026-09-25',
    '2026-10-05',
  ),
  tool(
    't-create-ticket',
    'create_ticket',
    '创建售后工单',
    '为订单创建售后工单，自动关联原始订单与客户。',
    [
      f('order_id', 'string', true, '关联订单号'),
      f('type', 'string', true, '工单类型', ['refund', 'exchange', 'repair', 'other']),
      f('description', 'string', true, '问题描述'),
    ],
    [f('ticket_id', 'string', true, '工单号'), f('status', 'string', true, '工单状态')],
    WRITE,
    '2026-09-25',
    '2026-10-04',
  ),
  tool(
    't-get-ticket',
    'get_ticket',
    '查询工单详情',
    '按工单号返回处理进度、责任人与沟通记录。',
    [f('ticket_id', 'string', true, '工单号')],
    [
      f('ticket_id', 'string', true, '工单号'),
      f('status', 'string', true, '工单状态', ['open', 'processing', 'closed']),
      f('assignee', 'string', false, '处理人'),
    ],
    RO,
    '2026-09-26',
    '2026-10-03',
  ),
  tool(
    't-close-ticket',
    'close_ticket',
    '关闭工单',
    '关闭已处理完成的工单并记录结案说明，可在 7 天内重开。',
    [f('ticket_id', 'string', true, '工单号'), f('resolution', 'string', true, '结案说明')],
    [f('ticket_id', 'string', true, '工单号'), f('status', 'string', true, '关闭后状态')],
    WRITE_IDEMPOTENT,
    '2026-09-26',
    '2026-10-02',
  ),
  tool(
    't-get-invoice',
    'get_invoice',
    '查询发票信息',
    '按订单号返回发票抬头、税号与开票状态。',
    [f('order_id', 'string', true, '订单号')],
    [
      f('invoice_no', 'string', false, '发票号码，未开票时为 null'),
      f('title', 'string', true, '发票抬头'),
      f('issued', 'boolean', true, '是否已开票'),
    ],
    RO,
    '2026-09-27',
    '2026-10-01',
  ),
  tool(
    't-export-report',
    'export_report',
    '导出经营报表',
    '按日期区间导出经营汇总报表，返回下载链接，链接 24 小时有效。',
    [
      f('start_date', 'string', true, '起始日期，格式 YYYY-MM-DD'),
      f('end_date', 'string', true, '结束日期，格式 YYYY-MM-DD'),
      f('format', 'string', false, '导出格式', ['csv', 'xlsx']),
    ],
    [f('download_url', 'string', true, '下载链接'), f('expires_at', 'string', true, '链接过期时间')],
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    '2026-09-27',
    '2026-09-30',
  ),
]))

/**
 * 字段 id → 中文名。早期草稿的字段还没有中文名字段，按 id 补回来，
 * 免得打开旧数据时整列中文名都是空的。
 */
export const SEED_TITLES: Record<string, string> = {}
function collectTitles(fields: SchemaField[]) {
  for (const field of fields) {
    if (field.title) SEED_TITLES[field.id] = field.title
    collectTitles(field.children)
  }
}
for (const tool of SEED_TOOLS) {
  collectTitles(tool.input)
  collectTitles(tool.output)
}

export const SEED_SERVER: ServerDoc = {
  id: 'srv-orders',
  name: '订单中心',
  description: '电商订单域的 MCP Server 设计稿，覆盖订单、物流、商品与售后四类工具。',
  transport: 'streamable-http',
  protocolVersion: '2025-06-18',
  tools: SEED_TOOLS,
}

/**
 * 默认数据只有「订单中心」这一个 Server（18 条工具）。
 * 之前演示用的商品中心 / 客服工作台 / 财务对账已移除：交付给别人时，
 * 侧栏挂一堆示例 Server 会让对方分不清哪些是自己的稿子。
 */
export const RETIRED_SEED_SERVER_IDS = ['srv-goods', 'srv-support', 'srv-finance']

/**
 * 工具 id → 种子里的时间戳。旧草稿只存了日期，读进来时用它把时刻补回去，
 * 免得升级后整张表都显示 00:00:00。
 */
export const SEED_TIMES: Record<string, { createdAt: string; updatedAt: string }> = Object.fromEntries(
  SEED_TOOLS.map((t) => [t.id, { createdAt: t.createdAt, updatedAt: t.updatedAt }]),
)
