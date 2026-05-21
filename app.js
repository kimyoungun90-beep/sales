const STORE_GROUPS = [
  { manager: "조재현K", stores: ["양재점", "광명점", "공세점", "평택점"] },
  { manager: "김현래K", stores: ["상봉점", "하남점", "양평점", "의정부점"] },
  { manager: "윤재경K", stores: ["일산점", "송도점", "고척점", "청라점", "천안점"] },
  { manager: "김영언K", stores: ["세종점", "대전점", "대구점", "혁신점"] },
  { manager: "심창보D", stores: ["부산점", "울산점", "김해점"] },
];

const STORE_LIST = STORE_GROUPS.flatMap(group => group.stores);
const MANAGER_BY_STORE = Object.fromEntries(STORE_GROUPS.flatMap(group => group.stores.map(store => [store, group.manager])));
const MX_OUTPUT_CATS = ["휴대폰", "태블릿", "PC", "웨어러블"];
const CE_BUSINESS_ORDER = ["TV", "에어컨", "냉장고", "김치냉장고", "세탁기", "건조기", "의류청정기", "청소기", "공기청정기", "조리기기", "SAC", "AV", "디스플레이", "프린터", "가전MD", "정수기", "제습기", "신발관리기"];

const $ = selector => document.querySelector(selector);

function setStatus(message, type = "") {
  const el = $("#status");
  el.innerHTML = message;
  el.className = `status ${type}`.trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function pct(actual, target) {
  const t = toNumber(target);
  if (!t) return null;
  return toNumber(actual) / t;
}

function safeText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeStore(raw) {
  let s = safeText(raw);
  if (!s) return "";

  if (s.includes("_")) {
    s = s.split("_").slice(1).join("_").trim();
  }

  s = s
    .replace(/\(주\)/g, "")
    .replace(/코스트코\s*코리아/g, "")
    .replace(/코스트코/g, "")
    .replace(/\s+/g, " ")
    .trim();

  s = s
    .replace(/대구혁신도시점/g, "혁신점")
    .replace(/서울상봉점/g, "상봉점")
    .replace(/^대구혁신도시$/g, "혁신점")
    .trim();

  return s;
}

function isExcludedZenielStore(raw) {
  const s = safeText(raw);
  if (!s) return true;
  return /평택물류창고|CDC온라인창고|코스트코\s*코리아|\(주\)코스트코\s*코리아/.test(s);
}

function isZenielMxCategory(category) {
  const s = safeText(category).replace(/\s+/g, "").toUpperCase();
  if (!s) return false;
  return ["웨어러블", "PC", "모바일", "태블릿", "휴대폰", "스마트폰", "자급제폰"].some(keyword => s.includes(keyword.toUpperCase()));
}

function mapMxProduct(product) {
  const s = safeText(product).replace(/\s+/g, "");
  if (!s) return "";
  if (s === "자급제폰" || s.includes("휴대폰") || s.includes("스마트폰")) return "휴대폰";
  if (s === "웨어러블") return "웨어러블";
  if (s === "태블릿") return "태블릿";
  if (s.toUpperCase() === "PC") return "PC";
  return "";
}

function makeEmptyStoreMap() {
  return Object.fromEntries(STORE_LIST.map(store => [store, 0]));
}

function makeEmptyStoreCategoryMap() {
  return Object.fromEntries(STORE_LIST.map(store => [store, {}]));
}

function addToNested(map, store, category, amount) {
  if (!map[store]) map[store] = {};
  if (!map[store][category]) map[store][category] = 0;
  map[store][category] += amount;
}

function getSheet(wb, exactName, fallbackKeyword) {
  if (wb.Sheets[exactName]) return wb.Sheets[exactName];
  const foundName = wb.SheetNames.find(name => name.replace(/\s/g, "").includes(fallbackKeyword.replace(/\s/g, "")));
  if (foundName) return wb.Sheets[foundName];
  throw new Error(`필수 시트를 찾을 수 없습니다: ${exactName}`);
}

function rowsFromSheet(ws) {
  // range: 0을 넣어야 엑셀의 실제 A열/1행 기준 위치가 유지됩니다.
  // 이 옵션이 없으면 SheetJS가 C5부터 데이터를 시작으로 판단해서
  // C열, E열, H열 같은 고정 컬럼 기준이 밀릴 수 있습니다.
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
    range: 0,
  });
}

function findRowIndex(rows, predicate, maxScan = rows.length) {
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i += 1) {
    if (predicate(rows[i] || [])) return i;
  }
  return -1;
}

function findHeaderIndexAndMap(rows, requiredLabels, maxScan = 80) {
  for (let i = 0; i < Math.min(rows.length, maxScan); i += 1) {
    const row = rows[i] || [];
    const map = {};
    row.forEach((value, idx) => {
      const text = safeText(value);
      if (text) map[text] = idx;
    });

    const hasAll = requiredLabels.every(label => map[label] !== undefined);
    if (hasAll) return { headerIndex: i, columnMap: map, header: row };
  }
  return { headerIndex: -1, columnMap: {}, header: [] };
}

function parseZeniel(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = rowsFromSheet(ws);

  // 중요: 제니엘 원본은 실제 데이터가 C열부터 시작하는 경우가 있어
  // SheetJS가 A/B 빈 열을 생략해서 row[2] 같은 고정 인덱스가 깨질 수 있습니다.
  // 그래서 C/E/F/H 고정 위치가 아니라 헤더명으로 컬럼을 찾습니다.
  const found = findHeaderIndexAndMap(rows, ["B2C경로그룹", "대표거래선", "품목", "메져_구분"], 80);
  const headerIndex = found.headerIndex;
  if (headerIndex < 0) {
    throw new Error("제니엘 파일에서 헤더 행을 찾지 못했습니다. B2C경로그룹 / 대표거래선 / 품목 / 메져_구분 헤더가 있는지 확인하세요.");
  }

  const header = found.header;
  const idxRoute = found.columnMap["B2C경로그룹"];
  const idxStore = found.columnMap["대표거래선"];
  const idxCategory = found.columnMap["품목"];
  const idxMeasure = found.columnMap["메져_구분"];
  const dateCols = [];

  header.forEach((value, idx) => {
    if (/^\d{2}Y\d{2}M\d{2}D$/.test(safeText(value))) dateCols.push(idx);
  });

  if (!dateCols.length) throw new Error("제니엘 파일에서 일자 컬럼(예: 26Y05M01D)을 찾지 못했습니다.");

  const ceByStore = makeEmptyStoreMap();
  const ceByStoreCat = makeEmptyStoreCategoryMap();
  const excludedStores = {};
  const excludedCategories = {};
  const unknownStores = {};
  let costcoRows = 0;
  let includedAmountRows = 0;
  let amountRows = 0;

  rows.slice(headerIndex + 1).forEach(row => {
    if (safeText(row[idxRoute]) !== "코스트코") return;
    costcoRows += 1;

    const rawStore = row[idxStore];
    if (isExcludedZenielStore(rawStore)) {
      excludedStores[safeText(rawStore)] = (excludedStores[safeText(rawStore)] || 0) + 1;
      return;
    }

    const store = normalizeStore(rawStore);
    if (!STORE_LIST.includes(store)) {
      unknownStores[safeText(rawStore)] = (unknownStores[safeText(rawStore)] || 0) + 1;
      return;
    }

    if (safeText(row[idxMeasure]) !== "금액") return;
    amountRows += 1;

    const category = safeText(row[idxCategory]) || "기타";
    if (isZenielMxCategory(category)) {
      excludedCategories[category] = (excludedCategories[category] || 0) + 1;
      return;
    }

    const amount = dateCols.reduce((sum, colIdx) => sum + toNumber(row[colIdx]), 0);
    ceByStore[store] += amount;
    addToNested(ceByStoreCat, store, category, amount);
    if (amount !== 0) includedAmountRows += 1;
  });

  return {
    ceByStore,
    ceByStoreCat,
    stats: {
      costcoRows,
      amountRows,
      includedAmountRows,
      headerRowExcel: headerIndex + 1,
      routeCol: XLSX.utils.encode_col(idxRoute),
      storeCol: XLSX.utils.encode_col(idxStore),
      categoryCol: XLSX.utils.encode_col(idxCategory),
      measureCol: XLSX.utils.encode_col(idxMeasure),
      dateCols: dateCols.length,
      firstDate: safeText(header[dateCols[0]]),
      lastDate: safeText(header[dateCols[dateCols.length - 1]]),
      excludedStores,
      excludedCategories,
      unknownStores,
    },
  };
}

function monthLabelFromInput(ym) {
  const [year, monthText] = ym.split("-");
  const yy = year.slice(-2);
  const month = Number(monthText);
  return `'${yy}.${month}월`;
}

function parseMx(wb, selectedMonth) {
  const ws = getSheet(wb, "매장별 셀인_26년(금액)", "매장별셀인_26년(금액)");
  const rows = rowsFromSheet(ws);
  const targetLabel = monthLabelFromInput(selectedMonth);

  const monthRowIndex = findRowIndex(rows, row => row.some(value => safeText(value) === targetLabel), 30);
  if (monthRowIndex < 0) {
    const preview = rows.slice(0, 30).flat().filter(Boolean).map(safeText).filter(v => /^'\d{2}\.\d+월$/.test(v)).join(", ");
    throw new Error(`MX 파일에서 ${targetLabel} 컬럼을 찾지 못했습니다. 현재 확인 가능한 월: ${preview || "없음"}`);
  }

  const monthRow = rows[monthRowIndex] || [];
  const monthCol = monthRow.findIndex(value => safeText(value) === targetLabel);

  const mxByStore = makeEmptyStoreMap();
  const mxByStoreCat = makeEmptyStoreCategoryMap();
  const unknownStores = {};
  let currentStore = "";
  let includedRows = 0;

  rows.slice(monthRowIndex + 2).forEach(row => {
    if (row[6]) currentStore = normalizeStore(row[6]);
    if (!currentStore) return;

    if (!STORE_LIST.includes(currentStore)) {
      if (!/전체|매장명|금액|코스트코 매장별/.test(currentStore)) {
        unknownStores[currentStore] = (unknownStores[currentStore] || 0) + 1;
      }
      return;
    }

    const product = mapMxProduct(row[7]);
    if (!product) return;

    const amount = toNumber(row[monthCol]);
    mxByStore[currentStore] += amount;
    addToNested(mxByStoreCat, currentStore, product, amount);
    includedRows += 1;
  });

  return {
    mxByStore,
    mxByStoreCat,
    stats: {
      targetLabel,
      monthRowExcel: monthRowIndex + 1,
      monthColExcel: XLSX.utils.encode_col(monthCol),
      includedRows,
      unknownStores,
    },
  };
}

function parseGoal(wb) {
  const ws = getSheet(wb, "매장별 목표", "매장별목표");
  const rows = rowsFromSheet(ws);
  const goals = Object.fromEntries(STORE_LIST.map(store => [store, { total: 0, ce: 0, mx: 0 }]));
  const unknownStores = {};
  let includedRows = 0;

  rows.forEach(row => {
    if (safeText(row[10]) !== "CC") return;
    const store = normalizeStore(row[12]);
    if (!STORE_LIST.includes(store)) {
      unknownStores[safeText(row[12])] = (unknownStores[safeText(row[12])] || 0) + 1;
      return;
    }

    goals[store] = {
      total: toNumber(row[14]),
      ce: toNumber(row[15]),
      mx: toNumber(row[16]),
    };
    includedRows += 1;
  });

  return { goals, stats: { includedRows, unknownStores } };
}

function uniqueCeCategories(ceByStoreCat) {
  const totals = {};
  STORE_LIST.forEach(store => {
    Object.entries(ceByStoreCat[store] || {}).forEach(([cat, value]) => {
      totals[cat] = (totals[cat] || 0) + value;
    });
  });

  const cats = Object.keys(totals).filter(cat => totals[cat] !== 0);
  cats.sort((a, b) => {
    const ia = CE_BUSINESS_ORDER.indexOf(a);
    const ib = CE_BUSINESS_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return totals[b] - totals[a];
  });
  return cats;
}

function wonToMillion(value) {
  return toNumber(value) / 1000000;
}

function sumStores(stores, getter) {
  return stores.reduce((sum, store) => sum + toNumber(getter(store)), 0);
}

function buildReportAoA(parsed, selectedMonth) {
  const { ceByStore, ceByStoreCat, mxByStore, mxByStoreCat, goals } = parsed;
  const ceCats = uniqueCeCategories(ceByStoreCat);

  const header = [
    "담당", "점포",
    "CE 목표", "CE 실적", "CE 달성률",
    ...ceCats.map(cat => `CE_${cat}`),
    "MX 목표", "MX 실적", "MX 달성률",
    ...MX_OUTPUT_CATS.map(cat => `MX_${cat}`),
    "전체 목표", "전체 실적", "전체 달성률",
  ];

  const title = [`코스트코 CE/MX 실적 자동 취합 보고`];
  const info = [`기준월: ${selectedMonth}`, `제니엘: 일자 전체 합산`, `단위: 백만원`, `생성일시: ${new Date().toLocaleString("ko-KR")}`];
  const aoa = [title, info, [], header];

  STORE_GROUPS.forEach(group => {
    group.stores.forEach(store => {
      const ceActual = wonToMillion(ceByStore[store]);
      const mxActual = wonToMillion(mxByStore[store]);
      const ceGoal = goals[store]?.ce || 0;
      const mxGoal = goals[store]?.mx || 0;
      const totalGoal = goals[store]?.total || ceGoal + mxGoal;
      const totalActual = ceActual + mxActual;

      aoa.push([
        group.manager, store,
        ceGoal, ceActual, pct(ceActual, ceGoal),
        ...ceCats.map(cat => wonToMillion(ceByStoreCat[store]?.[cat] || 0)),
        mxGoal, mxActual, pct(mxActual, mxGoal),
        ...MX_OUTPUT_CATS.map(cat => wonToMillion(mxByStoreCat[store]?.[cat] || 0)),
        totalGoal, totalActual, pct(totalActual, totalGoal),
      ]);
    });

    const stores = group.stores;
    const ceGoalSum = sumStores(stores, store => goals[store]?.ce || 0);
    const mxGoalSum = sumStores(stores, store => goals[store]?.mx || 0);
    const ceActualSum = sumStores(stores, store => wonToMillion(ceByStore[store]));
    const mxActualSum = sumStores(stores, store => wonToMillion(mxByStore[store]));
    const totalGoalSum = sumStores(stores, store => goals[store]?.total || 0);
    const totalActualSum = ceActualSum + mxActualSum;

    aoa.push([
      `${group.manager} 소계`, "",
      ceGoalSum, ceActualSum, pct(ceActualSum, ceGoalSum),
      ...ceCats.map(cat => sumStores(stores, store => wonToMillion(ceByStoreCat[store]?.[cat] || 0))),
      mxGoalSum, mxActualSum, pct(mxActualSum, mxGoalSum),
      ...MX_OUTPUT_CATS.map(cat => sumStores(stores, store => wonToMillion(mxByStoreCat[store]?.[cat] || 0))),
      totalGoalSum, totalActualSum, pct(totalActualSum, totalGoalSum),
    ]);
  });

  const ceGoalTotal = sumStores(STORE_LIST, store => goals[store]?.ce || 0);
  const mxGoalTotal = sumStores(STORE_LIST, store => goals[store]?.mx || 0);
  const ceActualTotal = sumStores(STORE_LIST, store => wonToMillion(ceByStore[store]));
  const mxActualTotal = sumStores(STORE_LIST, store => wonToMillion(mxByStore[store]));
  const totalGoalTotal = sumStores(STORE_LIST, store => goals[store]?.total || 0);
  const totalActualTotal = ceActualTotal + mxActualTotal;

  aoa.push([
    "전체 합계", "",
    ceGoalTotal, ceActualTotal, pct(ceActualTotal, ceGoalTotal),
    ...ceCats.map(cat => sumStores(STORE_LIST, store => wonToMillion(ceByStoreCat[store]?.[cat] || 0))),
    mxGoalTotal, mxActualTotal, pct(mxActualTotal, mxGoalTotal),
    ...MX_OUTPUT_CATS.map(cat => sumStores(STORE_LIST, store => wonToMillion(mxByStoreCat[store]?.[cat] || 0))),
    totalGoalTotal, totalActualTotal, pct(totalActualTotal, totalGoalTotal),
  ]);

  return { aoa, ceCats };
}

function buildDetailSheets(parsed) {
  const { ceByStore, ceByStoreCat, mxByStore, mxByStoreCat, goals } = parsed;
  const ceCats = uniqueCeCategories(ceByStoreCat);

  const ceHeader = ["담당", "점포", "CE 전체", ...ceCats];
  const ceAoa = [ceHeader];
  STORE_GROUPS.forEach(group => {
    group.stores.forEach(store => {
      ceAoa.push([group.manager, store, wonToMillion(ceByStore[store]), ...ceCats.map(cat => wonToMillion(ceByStoreCat[store]?.[cat] || 0))]);
    });
  });

  const mxHeader = ["담당", "점포", "MX 전체", ...MX_OUTPUT_CATS];
  const mxAoa = [mxHeader];
  STORE_GROUPS.forEach(group => {
    group.stores.forEach(store => {
      mxAoa.push([group.manager, store, wonToMillion(mxByStore[store]), ...MX_OUTPUT_CATS.map(cat => wonToMillion(mxByStoreCat[store]?.[cat] || 0))]);
    });
  });

  const goalAoa = [["담당", "점포", "전체 목표", "CE 목표", "MX 목표"]];
  STORE_GROUPS.forEach(group => {
    group.stores.forEach(store => {
      goalAoa.push([group.manager, store, goals[store]?.total || 0, goals[store]?.ce || 0, goals[store]?.mx || 0]);
    });
  });

  return { ceAoa, mxAoa, goalAoa };
}

function buildCheckSheet(parsed, selectedMonth) {
  const { zenielStats, mxStats, goalStats } = parsed;
  const aoa = [
    ["구분", "항목", "값"],
    ["기준", "MX 기준월", selectedMonth],
    ["제니엘", "C열 코스트코 행 수", zenielStats.costcoRows],
    ["제니엘", "H열 금액 행 수", zenielStats.amountRows],
    ["제니엘", "최종 반영 금액 행 수", zenielStats.includedAmountRows],
    ["제니엘", "헤더 행", zenielStats.headerRowExcel],
    ["제니엘", "경로/점포/품목/금액 컬럼", `${zenielStats.routeCol}/${zenielStats.storeCol}/${zenielStats.categoryCol}/${zenielStats.measureCol}`],
    ["제니엘", "합산 일자 수", zenielStats.dateCols],
    ["제니엘", "첫 일자", zenielStats.firstDate],
    ["제니엘", "마지막 일자", zenielStats.lastDate],
    ["MX", "선택 월 라벨", mxStats.targetLabel],
    ["MX", "선택 월 행", mxStats.monthRowExcel],
    ["MX", "선택 월 컬럼", mxStats.monthColExcel],
    ["MX", "반영 품목 행 수", mxStats.includedRows],
    ["목표", "CC 목표 반영 점포 수", goalStats.includedRows],
    [],
    ["제외/확인", "구분", "건수"],
  ];

  Object.entries(zenielStats.excludedStores).forEach(([name, count]) => aoa.push(["제니엘 제외점포", name, count]));
  Object.entries(zenielStats.excludedCategories).forEach(([name, count]) => aoa.push(["제니엘 MX품목 제외", name, count]));
  Object.entries(zenielStats.unknownStores).forEach(([name, count]) => aoa.push(["제니엘 미매핑 점포", name, count]));
  Object.entries(mxStats.unknownStores).forEach(([name, count]) => aoa.push(["MX 미매핑 점포", name, count]));
  Object.entries(goalStats.unknownStores).forEach(([name, count]) => aoa.push(["목표 미매핑 점포", name, count]));

  return aoa;
}

function styleSheet(ws, aoa, options = {}) {
  // Excel 안정성을 위해 복잡한 셀 스타일은 최소화합니다.
  // 일부 PC에서 xlsx-js-style로 생성한 진한 스타일/테두리 파일이 열릴 때 멈추는 사례가 있어
  // 숫자 표시 형식과 열 너비 중심으로만 적용합니다.
  if (!ws["!ref"]) return;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const headerRow = options.headerRow ?? 0;
  const percentColumns = options.percentColumns || [];
  const amountStartCol = options.amountStartCol ?? 2;

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      if (r > headerRow && c >= amountStartCol && typeof cell.v === "number") {
        cell.z = percentColumns.includes(c) ? "0.0%" : "#,##0.0";
      }
    }
  }
}

function borderAll(color) {
  return {
    top: { style: "thin", color: { rgb: color } },
    bottom: { style: "thin", color: { rgb: color } },
    left: { style: "thin", color: { rgb: color } },
    right: { style: "thin", color: { rgb: color } },
  };
}

function addSheet(wb, name, aoa, options = {}) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colCount = Math.max(...aoa.map(row => row.length));
  ws["!cols"] = Array.from({ length: colCount }, (_, idx) => {
    if (idx === 0) return { wch: 13 };
    if (idx === 1) return { wch: 13 };
    return { wch: options.compact ? 12 : 13 };
  });

  if (options.mergeTitle) {
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];
  }

  // 필터는 Excel 버전에 따라 열림 지연을 만들 수 있어 생성 파일 안정성을 우선해 제외합니다.
  styleSheet(ws, aoa, options);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function makeWorkbook(parsed, selectedMonth) {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: "코스트코 CE/MX 실적 자동 취합 보고",
    Subject: "Costco CE MX Sales Auto Report",
    Author: "자동취합 웹앱",
    CreatedDate: new Date(),
  };

  const report = buildReportAoA(parsed, selectedMonth);
  const detail = buildDetailSheets(parsed);
  const checkAoa = buildCheckSheet(parsed, selectedMonth);

  const headerRow = 3;
  const reportHeader = report.aoa[headerRow];
  const percentColumns = reportHeader.map((h, idx) => String(h).includes("달성률") ? idx : -1).filter(idx => idx >= 0);

  addSheet(wb, "보고용_요약", report.aoa, {
    headerRow,
    titleRows: [0],
    mergeTitle: true,
    autoFilterRow: headerRow,
    percentColumns,
    amountStartCol: 2,
  });

  addSheet(wb, "CE_품목별", detail.ceAoa, {
    headerRow: 0,
    autoFilterRow: 0,
    amountStartCol: 2,
    compact: true,
  });

  addSheet(wb, "MX_품목별", detail.mxAoa, {
    headerRow: 0,
    autoFilterRow: 0,
    amountStartCol: 2,
    compact: true,
  });

  addSheet(wb, "목표_확인", detail.goalAoa, {
    headerRow: 0,
    autoFilterRow: 0,
    amountStartCol: 2,
    compact: true,
  });

  addSheet(wb, "검증로그", checkAoa, {
    headerRow: 0,
    autoFilterRow: 0,
    amountStartCol: 2,
    compact: false,
  });

  return wb;
}

function readWorkbookFromInput(inputId) {
  const file = $(inputId).files?.[0];
  if (!file) return Promise.reject(new Error(`${inputId} 파일이 업로드되지 않았습니다.`));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const data = new Uint8Array(event.target.result);
        const wb = XLSX.read(data, { type: "array", cellDates: false, cellNF: false, cellStyles: false });
        resolve({ wb, fileName: file.name });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`));
    reader.readAsArrayBuffer(file);
  });
}

async function run() {
  try {
    setStatus("파일을 읽고 있습니다...", "");

    const selectedMonth = $("#monthPicker").value;
    if (!selectedMonth) throw new Error("MX 기준월을 선택하세요.");

    const [zeniel, mx, goal] = await Promise.all([
      readWorkbookFromInput("#zenielFile"),
      readWorkbookFromInput("#mxFile"),
      readWorkbookFromInput("#goalFile"),
    ]);

    const zenielParsed = parseZeniel(zeniel.wb);
    const mxParsed = parseMx(mx.wb, selectedMonth);
    const goalParsed = parseGoal(goal.wb);

    const parsed = {
      ceByStore: zenielParsed.ceByStore,
      ceByStoreCat: zenielParsed.ceByStoreCat,
      mxByStore: mxParsed.mxByStore,
      mxByStoreCat: mxParsed.mxByStoreCat,
      goals: goalParsed.goals,
      zenielStats: zenielParsed.stats,
      mxStats: mxParsed.stats,
      goalStats: goalParsed.stats,
    };

    const outWb = makeWorkbook(parsed, selectedMonth);
    const outputName = safeText($("#outputName").value) || "코스트코_CE_MX_실적_자동취합.xlsx";
    XLSX.writeFile(outWb, outputName.endsWith(".xlsx") ? outputName : `${outputName}.xlsx`, {
      bookType: "xlsx",
      bookSST: true,
      compression: true,
    });

    const ceTotal = STORE_LIST.reduce((sum, store) => sum + wonToMillion(parsed.ceByStore[store]), 0);
    const mxTotal = STORE_LIST.reduce((sum, store) => sum + wonToMillion(parsed.mxByStore[store]), 0);

    setStatus(
      `완료되었습니다. CE ${ceTotal.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}백만원, MX ${mxTotal.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}백만원 기준으로 보고용 엑셀을 생성했습니다.`,
      "ok"
    );
  } catch (error) {
    console.error(error);
    setStatus(`오류: ${error.message}`, "err");
  }
}

function clearAll() {
  ["#zenielFile", "#mxFile", "#goalFile"].forEach(id => { $(id).value = ""; });
  $("#monthPicker").value = "2026-05";
  $("#outputName").value = "코스트코_CE_MX_실적_자동취합.xlsx";
  setStatus("파일을 업로드한 뒤 생성 버튼을 누르세요.");
}

$("#runBtn").addEventListener("click", run);
$("#clearBtn").addEventListener("click", clearAll);
