"use client";

import { useMemo, useState } from "react";

type Workspace = "buyer" | "admin" | "warehouse" | "delivery";
type BuyerPage = "home" | "sourcing" | "purchase" | "orders" | "bills";
type AdminPage = "dashboard" | "products" | "customers" | "orders" | "inventory";

const fruits = [
  { name: "金枕榴莲", spec: "A果 · 18–20kg/箱", origin: "泰国", price: 758, unit: "箱", stock: 126, icon: "◒", color: "yellow" },
  { name: "阿克苏冰糖心", spec: "80mm+ · 10kg/箱", origin: "新疆", price: 168, unit: "箱", stock: 286, icon: "●", color: "red" },
  { name: "阳光玫瑰", spec: "特级 · 5kg/件", origin: "云南", price: 198, unit: "件", stock: 94, icon: "✣", color: "green" },
  { name: "海南贵妃芒", spec: "大果 · 10kg/箱", origin: "海南", price: 132, unit: "箱", stock: 168, icon: "◆", color: "orange" },
];

const flow = [
  ["01", "客户提交", "价格锁定，库存预占"],
  ["02", "销售审核", "核价、账期与额度校验"],
  ["03", "仓库备货", "拣货、缺货反馈"],
  ["04", "称重确认", "实重回填，金额重算"],
  ["05", "出库配送", "扣减库存，生成配送任务"],
  ["06", "签收结算", "收款或形成应收账款"],
];

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>("buyer");
  const [buyerPage, setBuyerPage] = useState<BuyerPage>("sourcing");
  const [adminPage, setAdminPage] = useState<AdminPage>("dashboard");
  const [category, setCategory] = useState("全部");
  const [selectedFruit, setSelectedFruit] = useState(0);
  const [quantity, setQuantity] = useState(10);
  const [showQuote, setShowQuote] = useState(false);
  const [flowStep, setFlowStep] = useState(3);

  const selected = fruits[selectedFruit];
  const tierPrice = quantity >= 50 ? selected.price - 18 : quantity >= 20 ? selected.price - 8 : selected.price;
  const total = tierPrice * quantity;
  const workspaceMeta = useMemo(() => ({
    buyer: ["采购客户", "微信小程序"],
    admin: ["经营管理", "PC 后台"],
    warehouse: ["仓库作业", "手持端"],
    delivery: ["配送执行", "移动端"],
  }[workspace]), [workspace]);

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">果</span>
          <span>
            <b>鲜链云</b>
            <small>水果批发 B2B 订货系统</small>
          </span>
        </div>
        <nav className="workspace-switch" aria-label="选择角色原型">
          {([
            ["buyer", "采购端"],
            ["admin", "管理后台"],
            ["warehouse", "仓库端"],
            ["delivery", "配送端"],
          ] as [Workspace, string][]).map(([key, label]) => (
            <button key={key} className={workspace === key ? "active" : ""} onClick={() => setWorkspace(key)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="stage-badge"><span />阶段 1 · 产品原型</div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">FRUIT WHOLESALE · PROCUREMENT OS</div>
          <h1>让找货、订货、仓配与结算<br /><em>在一条链路上完成</em></h1>
          <p>面向水果零售店、餐饮、商超、社区团购与小型批发商的专业 B2B 订货系统。</p>
        </div>
        <div className="hero-metrics">
          <div><b>4</b><span>业务端</span></div>
          <div><b>6</b><span>核心节点</span></div>
          <div><b>1</b><span>统一货盘</span></div>
        </div>
      </section>

      <section className="prototype-shell">
        <aside className="context-panel">
          <span className="panel-label">当前演示</span>
          <h2>{workspaceMeta[0]}</h2>
          <p>{workspaceMeta[1]}</p>
          <div className="context-divider" />
          <b className="context-title">关键任务</b>
          <ul>
            {workspace === "buyer" && <>
              <li>快速找到可售货源</li><li>看到专属成交价格</li><li>批量提交采购单</li><li>追踪订单与账单</li>
            </>}
            {workspace === "admin" && <>
              <li>掌握今日经营情况</li><li>统一管理商品价格</li><li>审核并跟进订单</li><li>控制库存与应收风险</li>
            </>}
            {workspace === "warehouse" && <>
              <li>接收待备货任务</li><li>按库位完成拣货</li><li>回填实际称重</li><li>确认出库与损耗</li>
            </>}
            {workspace === "delivery" && <>
              <li>领取配送任务</li><li>查看客户与货品</li><li>更新在途状态</li><li>上传签收结果</li>
            </>}
          </ul>
          <div className="principle">
            <span>设计原则</span>
            <b>少点一次，快一步</b>
            <p>高频批量操作优先，关键信息同屏，异常立即可见。</p>
          </div>
        </aside>

        <div className="device-stage">
          {workspace === "buyer" && (
            <div className="phone">
              <div className="phone-status"><b>09:41</b><span>● ● ▰</span></div>
              <div className="mini-header">
                <div><small>配送至</small><b>锦江水果店 · 春熙路店⌄</b></div>
                <button aria-label="消息">···</button>
              </div>
              <div className="phone-content">
                {buyerPage === "home" && <BuyerHome onSourcing={() => setBuyerPage("sourcing")} />}
                {buyerPage === "sourcing" && (
                  <>
                    <div className="search">⌕ <span>搜索商品 / 产地 / 品牌 / 规格</span></div>
                    <div className="primary-cats">
                      {["全部", "苹果", "葡萄", "榴莲", "柑橘"].map((item) =>
                        <button key={item} onClick={() => setCategory(item)} className={category === item ? "active" : ""}>{item}</button>
                      )}
                    </div>
                    <div className="sourcing-layout">
                      <div className="secondary-cats">
                        {["推荐货源", "今日特价", "进口水果", "国产鲜果", "礼盒装"].map((item, i) =>
                          <button key={item} className={i === 0 ? "active" : ""}>{item}</button>
                        )}
                      </div>
                      <div className="product-list">
                        <div className="list-head"><b>{category}货源</b><span>价格含箱，实重结算</span></div>
                        {fruits.map((fruit, i) => (
                          <button className={`product-card ${selectedFruit === i ? "selected" : ""}`} key={fruit.name} onClick={() => setSelectedFruit(i)}>
                            <span className={`fruit-visual ${fruit.color}`}>{fruit.icon}</span>
                            <span className="product-info">
                              <b>{fruit.name}</b><small>{fruit.origin} · {fruit.spec}</small>
                              <span className="tags"><i>可售 {fruit.stock}</i><i>阶梯价</i></span>
                              <span className="price"><strong>¥{fruit.price}</strong> / {fruit.unit}<em>＋</em></span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {buyerPage === "purchase" && (
                  <div className="purchase-page">
                    <div className="page-title"><b>采购单</b><span>共 3 种商品</span></div>
                    {fruits.slice(0, 3).map((fruit, i) => (
                      <div className="purchase-line" key={fruit.name}>
                        <span className={`fruit-mini ${fruit.color}`}>{fruit.icon}</span>
                        <div><b>{fruit.name}</b><small>{fruit.spec}</small><strong>¥{fruit.price}/{fruit.unit}</strong></div>
                        <span className="stepper">− &nbsp; {i ? 5 : quantity} &nbsp; ＋</span>
                      </div>
                    ))}
                    <div className="purchase-summary"><span>预计 <small>实重结算</small></span><b>¥{(total + 990).toLocaleString()}</b></div>
                    <button className="primary-btn">提交采购订单</button>
                  </div>
                )}
                {buyerPage === "orders" && <OrderTracking step={flowStep} onStep={setFlowStep} />}
                {buyerPage === "bills" && <Bills />}
              </div>
              <nav className="bottom-nav">
                {([
                  ["home", "⌂", "首页"],
                  ["sourcing", "⌕", "找货"],
                  ["purchase", "▣", "采购单"],
                  ["orders", "≡", "订单"],
                  ["bills", "¥", "账单"],
                ] as [BuyerPage, string, string][]).map(([key, icon, label]) =>
                  <button key={key} className={buyerPage === key ? "active" : ""} onClick={() => setBuyerPage(key)}>
                    <span>{icon}</span><small>{label}</small>{key === "purchase" && <i>3</i>}
                  </button>
                )}
              </nav>
            </div>
          )}

          {workspace === "admin" && (
            <AdminPrototype page={adminPage} setPage={setAdminPage} />
          )}

          {workspace === "warehouse" && (
            <TaskPrototype
              role="仓库工作台"
              code="SO202607240018"
              title="锦江水果店 · 10:30 前出库"
              meta="3 种商品 · 15 件 · 1 号冷库"
              steps={["领取任务", "开始拣货", "回填称重", "确认出库"]}
              accent="green"
            />
          )}

          {workspace === "delivery" && (
            <TaskPrototype
              role="配送任务"
              code="PS202607240009"
              title="锦江水果店 · 春熙路店"
              meta="陈店长 138****6608 · 15 件"
              steps={["待配送", "装车完成", "配送中", "客户签收"]}
              accent="orange"
            />
          )}
        </div>

        <aside className="detail-panel">
          <div className="detail-kicker">INTERACTION NOTE</div>
          {workspace === "buyer" && buyerPage === "sourcing" ? (
            <>
              <h3>{selected.name}</h3>
              <p>{selected.origin} · {selected.spec}</p>
              <div className="quote-box">
                <span>您的等级价</span><b>¥{selected.price}/{selected.unit}</b>
                <small>VIP 客户 · 已登录</small>
              </div>
              <label>采购数量 <b>{quantity} {selected.unit}</b></label>
              <input type="range" min="1" max="60" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              <div className="tier-row"><span>1–19<br />¥{selected.price}</span><span>20–49<br />¥{selected.price - 8}</span><span>50+<br />¥{selected.price - 18}</span></div>
              <div className="estimate"><span>当前成交价</span><b>¥{tierPrice}/{selected.unit}</b><small>预计金额 ¥{total.toLocaleString()}</small></div>
              <button className="detail-action" onClick={() => setShowQuote(!showQuote)}>{showQuote ? "已加入采购单 ✓" : "加入采购单"}</button>
            </>
          ) : (
            <>
              <h3>原型说明</h3>
              <p>点击端角色、底部导航和功能入口，可切换不同业务场景。</p>
              <div className="annotation-list">
                <span><i>01</i><b>业务优先</b><small>围绕订货履约，不引入 C 端营销功能</small></span>
                <span><i>02</i><b>数据贯通</b><small>订单驱动库存、配送、应收同步变化</small></span>
                <span><i>03</i><b>异常可见</b><small>缺货、超额度、称重差异前置提醒</small></span>
              </div>
            </>
          )}
        </aside>
      </section>

      <section className="architecture-section">
        <div className="section-heading">
          <div><span>INFORMATION ARCHITECTURE</span><h2>页面结构与功能边界</h2></div>
          <p>四端共用商品、客户、订单、库存与财务主数据；按角色呈现最短操作路径。</p>
        </div>
        <div className="ia-grid">
          <IaCard number="01" title="B 端采购小程序" accent="lime" items={[
            ["首页", "搜索、分类、今日价格、新品、热销"],
            ["找货", "一级/二级分类、货源列表、SKU、阶梯价"],
            ["采购单", "批量改量、删品、金额预估、提交"],
            ["订单", "状态追踪、称重差异、配送信息"],
            ["账单", "应付、已付、账期、付款记录"],
          ]} />
          <IaCard number="02" title="PC 经营后台" accent="dark" items={[
            ["数据看板", "销售、订单、利润、库存、应收"],
            ["商品价格", "SPU/SKU、分类、客户价、报价"],
            ["客户 CRM", "等级、负责人、额度、欠款"],
            ["订单履约", "审核、备货、称重、配送、售后"],
            ["供应链", "采购、库存、损耗、配送、财务"],
          ]} />
          <IaCard number="03" title="仓库作业端" accent="green" items={[
            ["入库", "采购到货、批次、成本、库位"],
            ["备货", "任务领取、按库位拣货、缺货反馈"],
            ["称重", "实重录入、差异提示、复核"],
            ["出库", "扫码复核、库存扣减、交接"],
            ["库存", "调整、盘点、损耗、预警"],
          ]} />
          <IaCard number="04" title="配送移动端" accent="orange" items={[
            ["任务", "待接单、配送中、已完成"],
            ["路线", "客户地址、电话、配送顺序"],
            ["装车", "货品清单、件数、交接确认"],
            ["签收", "签收人、凭证、异常说明"],
            ["状态", "到店、送达、拒收/差异"],
          ]} />
        </div>
      </section>

      <section className="flow-section">
        <div className="section-heading light">
          <div><span>CORE BUSINESS FLOW</span><h2>订单履约主流程</h2></div>
          <p>订单是全链路业务中枢。每一步都有责任角色、状态变化和关键数据动作。</p>
        </div>
        <div className="flow-track">
          {flow.map(([no, title, desc], i) => (
            <button key={no} onClick={() => setFlowStep(i)} className={flowStep === i ? "active" : ""}>
              <span>{no}</span><b>{title}</b><small>{desc}</small>
            </button>
          ))}
        </div>
        <div className="flow-detail">
          <span>当前节点</span>
          <b>{flow[flowStep][1]}</b>
          <p>{[
            "客户确认商品、SKU、数量、送达要求与优惠券，系统生成订单并预占可售库存。",
            "销售核对客户专属价格、信用额度、欠款与配送条件；通过后进入仓库任务池。",
            "仓库按批次与库位拣货；缺货时反馈销售协商替代品或修改数量。",
            "非标品录入实际重量或件重，超过容差需复核，系统自动重算订单最终金额。",
            "复核后扣减库存并生成配送单；配送员领取任务、装车并更新在途状态。",
            "客户确认签收；现金客户记录收款，月结客户生成应收并进入账期管理。",
          ][flowStep]}</p>
          <div><i>责任角色</i><strong>{["采购客户", "销售人员", "仓库人员", "仓库复核员", "仓库 / 配送", "客户 / 财务"][flowStep]}</strong></div>
          <div><i>状态迁移</i><strong>{["草稿 → 待审核", "待审核 → 待备货", "待备货 → 备货中", "备货中 → 待配送", "待配送 → 配送中", "配送中 → 已完成"][flowStep]}</strong></div>
        </div>
      </section>

      <section className="rules-section">
        <div className="section-heading">
          <div><span>BUSINESS RULES</span><h2>阶段 1 关键产品规则</h2></div>
          <p>先确认这些规则，再进入数据库和接口设计，可显著降低后续返工。</p>
        </div>
        <div className="rules-grid">
          <article><span>价格</span><h3>可解释的成交价</h3><p>基础价 → 客户等级价 → 数量阶梯价 → 销售报价 → 优惠券。结算时保留每一层价格快照。</p></article>
          <article><span>称重</span><h3>预估与最终金额分离</h3><p>下单展示预计金额；称重后形成最终金额。超出约定差异率时触发销售或客户确认。</p></article>
          <article><span>库存</span><h3>库存必须预占</h3><p>提交订单预占库存，审核取消或超时释放；出库时从实物库存扣减，避免重复销售。</p></article>
          <article><span>账期</span><h3>信用额度前置校验</h3><p>月结客户审核时校验“欠款 + 本单金额”是否超过额度，超额需管理员特批。</p></article>
          <article><span>优惠券</span><h3>B2B 条件精确匹配</h3><p>按客户等级、商品/品类、数量、金额和有效期校验；优惠效果按增量销售与毛利评估。</p></article>
          <article><span>SaaS</span><h3>组织与数据边界</h3><p>业务数据按租户隔离，门店、仓库、城市和销售归属可配置；总部可汇总，分支按权查看。</p></article>
        </div>
      </section>

      <footer>
        <div className="brand compact"><span className="brand-mark">果</span><span><b>鲜链云</b><small>阶段 1 原型交付</small></span></div>
        <p>本阶段仅定义产品体验、页面结构与业务流程。数据库、ER 图与 API 尚未展开。</p>
        <span>V0.1 · 2026.07</span>
      </footer>
    </main>
  );
}

function BuyerHome({ onSourcing }: { onSourcing: () => void }) {
  return <div className="home-page">
    <div className="search">⌕ <span>搜索今日货源</span></div>
    <div className="home-hero"><small>07.24 行情</small><h3>今日鲜果，源头直采</h3><p>榴莲行情下调 3.2%</p><button onClick={onSourcing}>立即找货 →</button></div>
    <div className="quick-grid"><button>今日价格<small>126 款更新</small></button><button>新品到货<small>今日 18 款</small></button><button>热销榜单<small>本周趋势</small></button></div>
    <div className="home-section"><b>为您推荐</b><span>按复购习惯推荐</span></div>
    {fruits.slice(0, 2).map(f => <div className="home-product" key={f.name}><span className={`fruit-mini ${f.color}`}>{f.icon}</span><div><b>{f.name}</b><small>{f.spec}</small><strong>¥{f.price}/{f.unit}</strong></div><button>＋</button></div>)}
  </div>;
}

function OrderTracking({ step, onStep }: { step: number; onStep: (n: number) => void }) {
  return <div className="order-page">
    <div className="page-title"><b>订单</b><span>全部订单</span></div>
    <div className="order-tabs"><button className="active">进行中 2</button><button>已完成</button><button>已取消</button></div>
    <div className="order-card">
      <div><span>SO202607240018</span><b>备货中</b></div>
      <p>预计今日 14:00–16:00 送达</p>
      <div className="order-progress">{flow.slice(0, 6).map((f, i) => <button key={f[0]} onClick={() => onStep(i)} className={i <= step ? "done" : ""}><i /><small>{f[1]}</small></button>)}</div>
      <div className="order-total"><span>3 种 · 15 件<br /><small>称重后结算</small></span><b>预计 ¥8,570</b></div>
      <button className="outline-btn">查看订单详情</button>
    </div>
  </div>;
}

function Bills() {
  return <div className="bills-page">
    <div className="page-title"><b>我的账单</b><span>月结客户</span></div>
    <div className="credit-card"><span>7 月待付款</span><b>¥28,560.00</b><small>账期截止 2026.08.05</small><div><i>信用额度 ¥100,000</i><i>可用 ¥71,440</i></div></div>
    <div className="bill-stats"><span><b>¥42,680</b><small>本月采购</small></span><span><b>¥14,120</b><small>本月已付</small></span></div>
    <div className="bill-list"><b>应付明细</b>{["SO202607220011", "SO202607180026", "SO202607120008"].map((id, i) => <div key={id}><span>{id}<small>7月{22 - i * 4}日 · 已完成</small></span><b>¥{[8570, 12180, 7810][i].toLocaleString()}</b></div>)}</div>
  </div>;
}

function AdminPrototype({ page, setPage }: { page: AdminPage; setPage: (p: AdminPage) => void }) {
  const labels: [AdminPage, string][] = [["dashboard", "经营看板"], ["products", "商品与价格"], ["customers", "客户 CRM"], ["orders", "订单履约"], ["inventory", "库存管理"]];
  return <div className="desktop">
    <aside className="admin-nav">
      <div className="brand invert"><span className="brand-mark">果</span><span><b>鲜链云</b><small>经营管理后台</small></span></div>
      <small className="nav-group">经营中心</small>
      {labels.map(([key, label], i) => <button key={key} onClick={() => setPage(key)} className={page === key ? "active" : ""}><span>{["◫", "◇", "◎", "≡", "▦"][i]}</span>{label}</button>)}
      <small className="nav-group">供应链</small>
      <button><span>↙</span>采购管理</button><button><span>⌁</span>配送管理</button><button><span>¥</span>财务管理</button>
      <div className="admin-user"><i>林</i><span><b>林经理</b><small>平台管理员</small></span></div>
    </aside>
    <div className="admin-main">
      <div className="admin-top"><span>华东一区 / 上海总部⌄</span><div>⌕ &nbsp; ◉ &nbsp; 2026年7月24日</div></div>
      {page === "dashboard" ? <AdminDashboard /> : <AdminList page={page} />}
    </div>
  </div>;
}

function AdminDashboard() {
  return <div className="dashboard">
    <div className="admin-title"><div><h3>下午好，林经理</h3><p>今日有 8 笔订单待处理，2 个库存预警。</p></div><button>＋ 创建销售订单</button></div>
    <div className="metric-grid">
      {[["今日销售额", "¥86,420", "+12.8%"], ["订单数量", "42", "+6"], ["预计毛利", "¥15,380", "17.8%"], ["应收账款", "¥286,500", "3 笔逾期"]].map((m, i) => <div key={m[0]}><span>{m[0]}</span><b>{m[1]}</b><small className={i === 3 ? "warn" : ""}>{m[2]}</small></div>)}
    </div>
    <div className="dashboard-grid">
      <div className="sales-chart"><div className="card-head"><b>近 7 日销售趋势</b><span>销售额⌄</span></div><div className="bars">{[42, 58, 48, 72, 66, 88, 76].map((h, i) => <span key={i} style={{height: `${h}%`}}><i>{["18", "19", "20", "21", "22", "23", "24"][i]}</i></span>)}</div></div>
      <div className="todo-card"><div className="card-head"><b>今日待办</b><span>查看全部</span></div>{[["待审核订单", "8", "green"], ["待备货任务", "12", "blue"], ["库存预警", "2", "orange"], ["逾期应收", "3", "red"]].map(t => <div key={t[0]}><i className={t[2]} /> <span>{t[0]}</span><b>{t[1]}</b></div>)}</div>
    </div>
    <div className="recent-table"><div className="card-head"><b>最新订单</b><span>进入订单中心 →</span></div><div className="table-head"><span>订单号</span><span>客户</span><span>金额</span><span>状态</span><span>负责人</span></div>{[["SO202607240018", "锦江水果店", "¥8,570", "备货中", "周敏"], ["SO202607240017", "好味餐饮集团", "¥16,820", "待审核", "王磊"], ["SO202607240016", "邻里社区团购", "¥6,460", "待配送", "周敏"]].map(r => <div className="table-row" key={r[0]}>{r.map((c, i) => <span key={c} className={i === 3 ? "status-pill" : ""}>{c}</span>)}</div>)}</div>
  </div>;
}

function AdminList({ page }: { page: AdminPage }) {
  const meta = {
    products: ["商品与价格", "统一维护 SPU、SKU、库存与多级价格", ["商品名称", "产地 / 规格", "基础价", "可售库存", "状态"]],
    customers: ["客户 CRM", "客户资料、分级、专属价格与信用额度", ["客户名称", "经营类型", "等级", "欠款金额", "销售负责人"]],
    orders: ["订单履约", "审核并跟进从下单到签收的完整流程", ["订单号", "客户", "订单金额", "订单状态", "负责人"]],
    inventory: ["库存管理", "按仓库与批次查看实物、锁定和可售库存", ["商品", "仓库 / 批次", "实物库存", "锁定库存", "可售库存"]],
  }[page as Exclude<AdminPage, "dashboard">];
  return <div className="admin-list-page"><div className="admin-title"><div><h3>{meta[0]}</h3><p>{meta[1]}</p></div><button>＋ 新建记录</button></div><div className="filter-bar"><span>⌕ 搜索关键词</span><button>全部状态⌄</button><button>更多筛选⌄</button><i>导出</i></div><div className="data-table"><div className="table-head">{meta[2].map(h => <span key={h}>{h}</span>)}</div>{fruits.map((f, i) => <div className="table-row" key={f.name}><span><b>{page === "orders" ? `SO2026072400${18-i}` : page === "customers" ? ["锦江水果店", "好味餐饮集团", "邻里社区团购", "好果批发"][i] : f.name}</b></span><span>{page === "customers" ? ["水果零售", "餐饮企业", "社区团购", "小型批发"][i] : f.spec}</span><span>{page === "customers" ? ["VIP", "大客户", "普通", "VIP"][i] : `¥${f.price}`}</span><span>{page === "orders" ? ["备货中", "待审核", "待配送", "已完成"][i] : f.stock}</span><span>{page === "customers" ? ["周敏", "王磊", "周敏", "林悦"][i] : "正常"}</span></div>)}</div></div>;
}

function TaskPrototype({ role, code, title, meta, steps, accent }: { role: string; code: string; title: string; meta: string; steps: string[]; accent: string }) {
  const [step, setStep] = useState(1);
  return <div className={`task-device ${accent}`}>
    <div className="task-head"><small>鲜链云 · 上海 1 号仓</small><h3>{role}</h3><div><span>今日待完成</span><b>{accent === "green" ? "12" : "8"} 单</b></div></div>
    <div className="task-tabs"><button className="active">待处理</button><button>进行中</button><button>已完成</button></div>
    <div className="task-card">
      <div className="task-code"><span>{code}</span><b>{steps[step]}</b></div>
      <h4>{title}</h4><p>{meta}</p>
      <div className="task-goods">{fruits.slice(0, 3).map((f, i) => <span key={f.name}><i className={`fruit-mini ${f.color}`}>{f.icon}</i><b>{f.name}</b><small>{[10, 3, 2][i]} 件</small></span>)}</div>
      <div className="task-steps">{steps.map((s, i) => <button key={s} onClick={() => setStep(i)} className={i <= step ? "done" : ""}><i />{s}</button>)}</div>
      <button className="task-action" onClick={() => setStep(Math.min(3, step + 1))}>{step === 3 ? "任务已完成 ✓" : `下一步：${steps[step + 1]}`}</button>
    </div>
    <div className="task-alert"><span>!</span><div><b>{accent === "green" ? "称重差异提醒" : "配送异常上报"}</b><p>{accent === "green" ? "阿克苏苹果实重超出预估 6%，请复核。" : "支持缺货、拒收、破损等现场异常留痕。"}</p></div></div>
  </div>;
}

function IaCard({ number, title, accent, items }: { number: string; title: string; accent: string; items: string[][] }) {
  return <article className={`ia-card ${accent}`}><div><span>{number}</span><h3>{title}</h3></div>{items.map(([name, desc]) => <p key={name}><b>{name}</b><span>{desc}</span></p>)}</article>;
}
