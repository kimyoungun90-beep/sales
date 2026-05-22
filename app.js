const STORE_GROUPS = [
  { manager: "조재현", stores: ["양재점", "광명점", "공세점", "평택점"] },
  { manager: "김현래", stores: ["상봉점", "하남점", "양평점", "의정부점"] },
  { manager: "윤재경", stores: ["일산점", "송도점", "고척점", "청라점", "천안점"] },
  { manager: "김영언", stores: ["세종점", "대전점", "대구점", "혁신점"] },
  { manager: "심창보", stores: ["부산점", "울산점", "김해점"] },
];

const STORE_LIST = STORE_GROUPS.flatMap(group => group.stores);
const MANAGER_BY_STORE = Object.fromEntries(STORE_GROUPS.flatMap(group => group.stores.map(store => [store, group.manager])));
const MX_OUTPUT_CATS = ["휴대폰", "태블릿", "PC", "웨어러블"];
const CE_BUSINESS_ORDER = ["TV", "에어컨", "냉장고", "김치냉장고", "세탁기", "건조기", "의류청정기", "청소기", "공기청정기", "조리기기", "SAC", "AV", "디스플레이", "프린터", "가전MD", "정수기", "제습기", "신발관리기"];
const MAIN_CE_CATS = ["TV", "에어컨", "냉장고", "김치냉장고", "세탁기", "건조기"];

const COLORS = {
  navy: "182642",
  navy2: "203764",
  blue: "2F5597",
  green: "0F766E",
  teal: "DDEFEA",
  lightBlue: "EAF2FF",
  paleGreen: "E2F0D9",
  paleYellow: "FFF2CC",
  gray: "F3F6FA",
  white: "FFFFFF",
  border: "B7C9E2",
  red: "C00000",
  black: "111827",
};

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

function rate(actual, target) {
  const t = toNumber(target);
  if (!t) return null;
  return toNumber(actual) / t;
}

function ratePctText(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function millionText(value) {
  return `${toNumber(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}백만원`;
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

function makeEmptyStoreModelMap() {
  return Object.fromEntries(STORE_LIST.map(store => [store, {}]));
}


function makeEmptyStoreAirconSetMap() {
  return Object.fromEntries(STORE_LIST.map(store => [store, {}]));
}

function isAirconCategory(category) {
  return safeText(category).replace(/\s+/g, "") === "에어컨";
}

function deriveAirconSetModel(model) {
  const m = safeText(model).replace(/\s+/g, "").toUpperCase();
  if (!m) return "";

  // 삼성 스탠드 실내기 표기 예: AF60F17D11WN -> 세트명 AF60F17D11WRT
  // AF80F19D25BN -> AF80F19D25BRT 형태로 보고용 표기
  const stand = m.match(/^(AF\d{2}[A-Z]\d{2}D\d{2})([A-Z])N$/);
  if (stand) return `${stand[1]}${stand[2]}RT`;

  // 이미 세트명으로 들어온 경우는 그대로 사용
  if (/^AF\d{2}[A-Z]\d{2}D\d{2}[A-Z]RT$/.test(m)) return m;

  return "";
}

function isAirconComponentModel(model) {
  const m = safeText(model).replace(/\s+/g, "").toUpperCase();
  if (!m) return false;
  return /^(FPC|FRC|AFR|ARR|AIR|AIP)/.test(m) || /^AF\d{2}[A-Z]\d{2}D\d[A-Z]BX$/.test(m);
}

function resolveAirconSetModel(store, model, currentAirconSetByStore) {
  const direct = deriveAirconSetModel(model);
  if (direct) {
    currentAirconSetByStore[store] = direct;
    return direct;
  }
  if (isAirconComponentModel(model) && currentAirconSetByStore[store]) return currentAirconSetByStore[store];
  return safeText(model) || "모델 미기재";
}

function addToAirconSetMap(map, store, setModel, amount = 0, qty = 0) {
  if (!map[store]) map[store] = {};
  const key = safeText(setModel) || "세트명 미확인";
  if (!map[store][key]) map[store][key] = { setModel: key, amount: 0, qty: 0 };
  map[store][key].amount += toNumber(amount);
  map[store][key].qty += toNumber(qty);
}

function addToNested(map, store, category, amount) {
  if (!map[store]) map[store] = {};
  if (!map[store][category]) map[store][category] = 0;
  map[store][category] += amount;
}

function addToModelMap(map, store, category, model, amount) {
  if (!map[store]) map[store] = {};
  const safeModel = safeText(model) || "모델 미기재";
  const key = `${category}||${safeModel}`;
  if (!map[store][key]) map[store][key] = { category, model: safeModel, amount: 0 };
  map[store][key].amount += amount;
}

function getSheet(wb, exactName, fallbackKeyword) {
  if (wb.Sheets[exactName]) return wb.Sheets[exactName];
  const foundName = wb.SheetNames.find(name => name.replace(/\s/g, "").includes(fallbackKeyword.replace(/\s/g, "")));
  if (foundName) return wb.Sheets[foundName];
  throw new Error(`필수 시트를 찾을 수 없습니다: ${exactName}`);
}

function rowsFromSheet(ws) {
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
  const found = findHeaderIndexAndMap(rows, ["B2C경로그룹", "대표거래선", "품목", "메져_구분"], 80);
  const headerIndex = found.headerIndex;
  if (headerIndex < 0) {
    throw new Error("제니엘 파일에서 헤더 행을 찾지 못했습니다. B2C경로그룹 / 대표거래선 / 품목 / 메져_구분 헤더가 있는지 확인하세요.");
  }

  const header = found.header;
  const idxRoute = found.columnMap["B2C경로그룹"];
  const idxStore = found.columnMap["대표거래선"];
  const idxCategory = found.columnMap["품목"];
  const idxModel = found.columnMap["모델"];
  const idxMeasure = found.columnMap["메져_구분"];
  const dateCols = [];

  header.forEach((value, idx) => {
    if (/^\d{2}Y\d{2}M\d{2}D$/.test(safeText(value))) dateCols.push(idx);
  });

  if (!dateCols.length) throw new Error("제니엘 파일에서 일자 컬럼(예: 26Y05M01D)을 찾지 못했습니다.");

  const ceByStore = makeEmptyStoreMap();
  const ceByStoreCat = makeEmptyStoreCategoryMap();
  const ceModelByStore = makeEmptyStoreModelMap();
  const airconSetByStore = makeEmptyStoreAirconSetMap();
  const currentAirconSetByStore = {};
  const excludedStores = {};
  const excludedCategories = {};
  const unknownStores = {};
  let costcoRows = 0;
  let includedAmountRows = 0;
  let amountRows = 0;
  let airconSetRows = 0;

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

    const category = safeText(row[idxCategory]) || "기타";
    const measure = safeText(row[idxMeasure]);
    const model = idxModel === undefined ? "" : safeText(row[idxModel]);
    const rowTotal = dateCols.reduce((sum, colIdx) => sum + toNumber(row[colIdx]), 0);

    // 에어컨은 모델_TOP/보고멘트에서 세트명 기준으로 보기 위해 수량·금액을 별도 집계
    // 단, 전체 CE 매출 산식은 기존처럼 H열 금액만 반영한다.
    if (isAirconCategory(category)) {
      const setModel = resolveAirconSetModel(store, model, currentAirconSetByStore);
      if (measure === "수량" && deriveAirconSetModel(model)) {
        addToAirconSetMap(airconSetByStore, store, setModel, 0, rowTotal);
        airconSetRows += 1;
      } else if (measure === "금액") {
        addToAirconSetMap(airconSetByStore, store, setModel, rowTotal, 0);
        airconSetRows += 1;
      }
    }

    if (measure !== "금액") return;
    amountRows += 1;

    if (isZenielMxCategory(category)) {
      excludedCategories[category] = (excludedCategories[category] || 0) + 1;
      return;
    }

    const amount = rowTotal;
    const reportModel = isAirconCategory(category) ? resolveAirconSetModel(store, model, currentAirconSetByStore) : model;
    ceByStore[store] += amount;
    addToNested(ceByStoreCat, store, category, amount);
    addToModelMap(ceModelByStore, store, category, reportModel, amount);
    if (amount !== 0) includedAmountRows += 1;
  });

  return {
    ceByStore,
    ceByStoreCat,
    ceModelByStore,
    airconSetByStore,
    stats: {
      costcoRows,
      amountRows,
      includedAmountRows,
      airconSetRows,
      headerRowExcel: headerIndex + 1,
      routeCol: XLSX.utils.encode_col(idxRoute),
      storeCol: XLSX.utils.encode_col(idxStore),
      categoryCol: XLSX.utils.encode_col(idxCategory),
      modelCol: idxModel === undefined ? "없음" : XLSX.utils.encode_col(idxModel),
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
  const mxModelByStore = makeEmptyStoreModelMap();
  const unknownStores = {};
  let currentStore = "";
  let currentProduct = "";
  let includedRows = 0;
  let includedModelRows = 0;

  rows.slice(monthRowIndex + 2).forEach(row => {
    if (row[6]) currentStore = normalizeStore(row[6]);
    if (!currentStore) return;

    if (!STORE_LIST.includes(currentStore)) {
      if (!/전체|매장명|금액|코스트코 매장별/.test(currentStore)) {
        unknownStores[currentStore] = (unknownStores[currentStore] || 0) + 1;
      }
      return;
    }

    const productFromRow = mapMxProduct(row[7]);
    const modelGroup = safeText(row[8]);
    const amount = toNumber(row[monthCol]);

    if (productFromRow) {
      currentProduct = productFromRow;
      mxByStore[currentStore] += amount;
      addToNested(mxByStoreCat, currentStore, productFromRow, amount);
      includedRows += 1;
      return;
    }

    if (currentProduct && modelGroup && amount !== 0) {
      addToModelMap(mxModelByStore, currentStore, currentProduct, modelGroup, amount);
      includedModelRows += 1;
    }
  });

  return {
    mxByStore,
    mxByStoreCat,
    mxModelByStore,
    stats: {
      targetLabel,
      monthRowExcel: monthRowIndex + 1,
      monthColExcel: XLSX.utils.encode_col(monthCol),
      includedRows,
      includedModelRows,
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

function getTopFromObject(obj, n = 3) {
  return Object.entries(obj || {})
    .map(([name, value]) => ({ name, value: toNumber(value) }))
    .filter(item => item.value !== 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

function getTopModels(modelMap, store, categoryFilter = null, n = 3) {
  return Object.values(modelMap[store] || {})
    .filter(item => item.amount !== 0 && (!categoryFilter || item.category === categoryFilter))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

function makeStoreRows(parsed) {
  const { ceByStore, mxByStore, goals } = parsed;
  const rows = [];
  STORE_GROUPS.forEach(group => {
    group.stores.forEach(store => {
      const ceActual = wonToMillion(ceByStore[store]);
      const mxActual = wonToMillion(mxByStore[store]);
      const ceGoal = goals[store]?.ce || 0;
      const mxGoal = goals[store]?.mx || 0;
      const totalGoal = goals[store]?.total || ceGoal + mxGoal;
      const totalActual = ceActual + mxActual;
      rows.push({
        type: "store",
        manager: group.manager,
        store,
        totalGoal,
        totalActual,
        totalRate: rate(totalActual, totalGoal),
        ceGoal,
        ceActual,
        ceRate: rate(ceActual, ceGoal),
        mxGoal,
        mxActual,
        mxRate: rate(mxActual, mxGoal),
      });
    });
  });
  addRanks(rows);
  return rows;
}

function addRanks(rows) {
  const rankSpecs = [
    ["totalActual", "totalSalesRank"],
    ["ceActual", "ceSalesRank"],
    ["ceRate", "ceRateRank"],
    ["totalRate", "totalRateRank"],
    ["mxActual", "mxSalesRank"],
    ["mxRate", "mxRateRank"],
  ];

  rankSpecs.forEach(([valueKey, rankKey]) => {
    const sorted = [...rows]
      .filter(row => row.type === "store" && row[valueKey] !== null && row[valueKey] !== undefined)
      .sort((a, b) => toNumber(b[valueKey]) - toNumber(a[valueKey]));

    let lastValue = null;
    let lastRank = 0;
    sorted.forEach((row, idx) => {
      const value = toNumber(row[valueKey]);
      const rank = value === lastValue ? lastRank : idx + 1;
      row[rankKey] = rank;
      lastValue = value;
      lastRank = rank;
    });
  });
}

function buildSummaryAoA(parsed, selectedMonth) {
  const storeRows = makeStoreRows(parsed);
  const groupHeader = [
    "담당", "점포",
    "총 매출", "", "", "", "",
    "CE 매출", "", "", "", "",
    "MX 매출", "", "", "", "",
  ];
  const subHeader = [
    "담당", "점포",
    "목표", "매출", "순위", "달성률", "순위",
    "목표", "매출", "순위", "달성률", "순위",
    "목표", "매출", "순위", "달성률", "순위",
  ];

  const aoa = [
    ["코스트코 CE/MX 실적 자동 취합 보고"],
    [`기준월: ${selectedMonth}`, "단위: 백만원", `생성일시: ${new Date().toLocaleString("ko-KR")}`, "구성: 보고용 요약 / 보고멘트 / 품목별 / 검증로그"],
    [],
    groupHeader,
    subHeader,
  ];

  STORE_GROUPS.forEach(group => {
    const groupRows = storeRows.filter(row => row.manager === group.manager);
    groupRows.forEach(row => {
      aoa.push([
        row.manager, row.store,
        row.totalGoal, row.totalActual, row.totalSalesRank, row.totalRate, row.totalRateRank,
        row.ceGoal, row.ceActual, row.ceSalesRank, row.ceRate, row.ceRateRank,
        row.mxGoal, row.mxActual, row.mxSalesRank, row.mxRate, row.mxRateRank,
      ]);
    });

    const totalGoal = sumStores(group.stores, store => parsed.goals[store]?.total || 0);
    const ceGoal = sumStores(group.stores, store => parsed.goals[store]?.ce || 0);
    const mxGoal = sumStores(group.stores, store => parsed.goals[store]?.mx || 0);
    const ceActual = sumStores(group.stores, store => wonToMillion(parsed.ceByStore[store]));
    const mxActual = sumStores(group.stores, store => wonToMillion(parsed.mxByStore[store]));
    const totalActual = ceActual + mxActual;

    aoa.push([
      group.manager, "총 매출",
      totalGoal, totalActual, "", rate(totalActual, totalGoal), "",
      ceGoal, ceActual, "", rate(ceActual, ceGoal), "",
      mxGoal, mxActual, "", rate(mxActual, mxGoal), "",
    ]);
  });

  const totalGoal = sumStores(STORE_LIST, store => parsed.goals[store]?.total || 0);
  const ceGoal = sumStores(STORE_LIST, store => parsed.goals[store]?.ce || 0);
  const mxGoal = sumStores(STORE_LIST, store => parsed.goals[store]?.mx || 0);
  const ceActual = sumStores(STORE_LIST, store => wonToMillion(parsed.ceByStore[store]));
  const mxActual = sumStores(STORE_LIST, store => wonToMillion(parsed.mxByStore[store]));
  const totalActual = ceActual + mxActual;

  aoa.push([
    "전체", "총 매출",
    totalGoal, totalActual, "", rate(totalActual, totalGoal), "",
    ceGoal, ceActual, "", rate(ceActual, ceGoal), "",
    mxGoal, mxActual, "", rate(mxActual, mxGoal), "",
  ]);

  return { aoa, storeRows };
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

function buildModelTopAoa(parsed) {
  const rows = [["구분", "담당", "점포", "품목", "모델/모델군", "실적"]];
  STORE_GROUPS.forEach(group => {
    group.stores.forEach(store => {
      getTopModels(parsed.ceModelByStore, store, null, 10).forEach(item => {
        rows.push(["CE", group.manager, store, item.category, item.model, wonToMillion(item.amount)]);
      });
      getTopModels(parsed.mxModelByStore, store, null, 10).forEach(item => {
        rows.push(["MX", group.manager, store, item.category, item.model, wonToMillion(item.amount)]);
      });
    });
  });
  return rows;
}


function buildAirconSetAoa(parsed) {
  const rows = [["담당", "점포", "에어컨 세트명", "판매수량", "매출"]];
  STORE_GROUPS.forEach(group => {
    group.stores.forEach(store => {
      Object.values(parsed.airconSetByStore?.[store] || {})
        .filter(item => item.amount !== 0 || item.qty !== 0)
        .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
        .forEach(item => {
          rows.push([group.manager, store, item.setModel, item.qty, wonToMillion(item.amount)]);
        });
    });
  });
  return rows;
}

function textTopList(items, limit = 3) {
  if (!items.length) return "특이 기여 품목 없음";
  return items.slice(0, limit).map(item => `${item.name} ${millionText(item.value)}`).join(", ");
}

function textTopModels(items, limit = 3) {
  if (!items.length) return "모델별 실적 확인 필요";
  return items.slice(0, limit).map(item => `${item.category} ${item.model} ${millionText(wonToMillion(item.amount))}`).join(", ");
}

function buildWeakPoint(store, ceCats, mxCats, row) {
  const points = [];
  const ceRate = row.ceRate ?? 0;
  const mxRate = row.mxRate ?? 0;
  const totalRate = row.totalRate ?? 0;

  if (totalRate < 0.6) points.push("전체 달성률이 60% 미만으로 목표 대비 실적 보강 필요");
  if (ceRate < 0.65) points.push("CE 달성률 관리 필요");
  if (mxRate < 0.4) points.push("MX 달성률이 낮아 휴대폰/태블릿/웨어러블 전환 활동 점검 필요");

  const mainLow = MAIN_CE_CATS.filter(cat => toNumber(ceCats[cat]) === 0 || wonToMillion(ceCats[cat]) < Math.max(3, row.ceActual * 0.03));
  if (mainLow.length) {
    points.push(`${mainLow.slice(0, 3).join("·")} 기여가 낮아 재고, 진열, 행사 고지, 설치완료 반영 여부 확인 필요`);
  }

  if (!points.length) points.push("목표 대비 흐름 양호. 상위 품목 중심 판매 유지 및 저기여 품목 추가 점검 필요");
  return points.slice(0, 3).join(" / ");
}

function buildReportComment(parsed, row) {
  const store = row.store;
  const ceCats = parsed.ceByStoreCat[store] || {};
  const mxCats = parsed.mxByStoreCat[store] || {};
  const ceTop = getTopFromObject(Object.fromEntries(Object.entries(ceCats).map(([k, v]) => [k, wonToMillion(v)])), 3);
  const mxTop = getTopFromObject(Object.fromEntries(Object.entries(mxCats).map(([k, v]) => [k, wonToMillion(v)])), 3);
  const topCeCategory = ceTop[0]?.name || null;
  const ceTopModels = getTopModels(parsed.ceModelByStore, store, topCeCategory, 3);
  const ceAllTopModels = ceTopModels.length ? ceTopModels : getTopModels(parsed.ceModelByStore, store, null, 3);
  const mxTopModels = getTopModels(parsed.mxModelByStore, store, null, 3);
  const weakPoint = buildWeakPoint(store, ceCats, mxCats, row);
  const tone = (row.totalRate ?? 0) >= 0.9 ? "목표 접근 흐름이 양호" : (row.totalRate ?? 0) >= 0.6 ? "일부 품목 보강 시 추가 개선 여지" : "목표 대비 보강이 필요한 상황";

  return [
    `${store} 매출 현황`,
    `ㆍ전체 실적은 ${millionText(row.totalActual)}으로 총 목표 ${millionText(row.totalGoal)} 대비 ${ratePctText(row.totalRate)} 수준이며, ${tone}입니다.`,
    `ㆍCE 실적은 ${millionText(row.ceActual)} / 목표 ${millionText(row.ceGoal)} / 달성률 ${ratePctText(row.ceRate)}입니다. 주요 기여 품목은 ${textTopList(ceTop)} 중심입니다.`,
    `ㆍCE 대표 모델은 ${textTopModels(ceAllTopModels)} 기준으로 확인됩니다.`,
    `ㆍMX 실적은 ${millionText(row.mxActual)} / 목표 ${millionText(row.mxGoal)} / 달성률 ${ratePctText(row.mxRate)}이며, ${textTopList(mxTop)} 중심입니다. MX 모델군은 ${textTopModels(mxTopModels)} 흐름입니다.`,
    `ㆍ점검 포인트: ${weakPoint}.`,
    `→ 보고 시에는 상위 기여 품목은 유지하고, 저조 품목은 재고/진열/행사 안내/설치완료 반영 지연 여부를 확인하는 방향으로 정리 권장.`,
  ].join("\n");
}

function buildReportCommentAoa(parsed, storeRows) {
  const aoa = [["담당", "점포", "총 실적", "총 달성률", "CE 주요 품목", "MX 주요 품목", "자동 보고멘트"]];
  storeRows.forEach(row => {
    const ceTop = getTopFromObject(Object.fromEntries(Object.entries(parsed.ceByStoreCat[row.store] || {}).map(([k, v]) => [k, wonToMillion(v)])), 3);
    const mxTop = getTopFromObject(Object.fromEntries(Object.entries(parsed.mxByStoreCat[row.store] || {}).map(([k, v]) => [k, wonToMillion(v)])), 3);
    aoa.push([
      row.manager,
      row.store,
      row.totalActual,
      row.totalRate,
      textTopList(ceTop),
      textTopList(mxTop),
      buildReportComment(parsed, row),
    ]);
  });
  return aoa;
}

function buildCheckSheet(parsed, selectedMonth) {
  const { zenielStats, mxStats, goalStats } = parsed;
  const aoa = [
    ["구분", "항목", "값"],
    ["기준", "MX 기준월", selectedMonth],
    ["제니엘", "코스트코 행 수", zenielStats.costcoRows],
    ["제니엘", "금액 행 수", zenielStats.amountRows],
    ["제니엘", "최종 반영 금액 행 수", zenielStats.includedAmountRows],
    ["제니엘", "에어컨 세트 집계 행 수", zenielStats.airconSetRows],
    ["제니엘", "헤더 행", zenielStats.headerRowExcel],
    ["제니엘", "경로/점포/품목/모델/금액 컬럼", `${zenielStats.routeCol}/${zenielStats.storeCol}/${zenielStats.categoryCol}/${zenielStats.modelCol}/${zenielStats.measureCol}`],
    ["제니엘", "합산 일자 수", zenielStats.dateCols],
    ["제니엘", "첫 일자", zenielStats.firstDate],
    ["제니엘", "마지막 일자", zenielStats.lastDate],
    ["MX", "선택 월 라벨", mxStats.targetLabel],
    ["MX", "선택 월 행", mxStats.monthRowExcel],
    ["MX", "선택 월 컬럼", mxStats.monthColExcel],
    ["MX", "반영 품목 행 수", mxStats.includedRows],
    ["MX", "반영 모델군 행 수", mxStats.includedModelRows],
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

function borderStyle(color = COLORS.border) {
  return {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function fill(color) {
  return { type: "pattern", pattern: "solid", fgColor: { argb: color } };
}

function styleCommonSheet(ws, opts = {}) {
  const headerRowNo = opts.headerRowNo || 1;
  const maxCol = ws.columnCount;
  ws.getRow(headerRowNo).height = 24;
  ws.getRow(headerRowNo).eachCell(cell => {
    cell.fill = fill(opts.headerFill || COLORS.navy2);
    cell.font = { bold: true, color: { argb: COLORS.white }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = borderStyle("8EA9DB");
  });

  for (let r = headerRowNo + 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    row.eachCell((cell, colNo) => {
      cell.border = borderStyle("D9E2F3");
      cell.alignment = { horizontal: colNo <= 2 ? "center" : "right", vertical: "middle", wrapText: false };
      if (r % 2 === 0) cell.fill = fill("F8FAFD");
    });
  }

  if (opts.autoFilter) ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: ws.rowCount, column: maxCol } };
}

function writeAoA(ws, aoa) {
  aoa.forEach(row => ws.addRow(row));
}

function setWidths(ws, widths) {
  widths.forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });
}

function styleSummarySheet(ws) {
  ws.mergeCells(1, 1, 1, 17);
  ws.getCell("A1").font = { bold: true, size: 18, color: { argb: COLORS.white } };
  ws.getCell("A1").fill = fill(COLORS.navy);
  ws.getCell("A1").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, 17);
  ws.getCell("A2").font = { size: 10, color: { argb: "DDEBFF" } };
  ws.getCell("A2").fill = fill(COLORS.navy);
  ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };

  // 4행: 총 매출 / CE 매출 / MX 매출 대분류, 5행: 목표·매출·순위·달성률·순위 세부항목
  ws.mergeCells(4, 1, 5, 1);
  ws.mergeCells(4, 2, 5, 2);
  ws.mergeCells(4, 3, 4, 7);
  ws.mergeCells(4, 8, 4, 12);
  ws.mergeCells(4, 13, 4, 17);

  const groupColors = {
    total: COLORS.green,
    ce: COLORS.blue,
    mx: "5B7F95",
    base: COLORS.navy2,
  };

  [1, 2].forEach(colNo => {
    const cell = ws.getRow(4).getCell(colNo);
    cell.fill = fill(groupColors.base);
    cell.font = { bold: true, color: { argb: COLORS.white }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = borderStyle("FFFFFF");
  });
  [
    { start: 3, end: 7, color: groupColors.total },
    { start: 8, end: 12, color: groupColors.ce },
    { start: 13, end: 17, color: groupColors.mx },
  ].forEach(group => {
    for (let c = group.start; c <= group.end; c += 1) {
      const cell = ws.getRow(4).getCell(c);
      cell.fill = fill(group.color);
      cell.font = { bold: true, color: { argb: COLORS.white }, size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = borderStyle("FFFFFF");
    }
  });

  const subHeader = ws.getRow(5);
  subHeader.height = 25;
  subHeader.eachCell((cell, colNo) => {
    let color = groupColors.base;
    if (colNo >= 3 && colNo <= 7) color = groupColors.total;
    if (colNo >= 8 && colNo <= 12) color = groupColors.ce;
    if (colNo >= 13) color = groupColors.mx;
    cell.fill = fill(color);
    cell.font = { bold: true, color: { argb: COLORS.white }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = borderStyle("FFFFFF");
  });

  for (let r = 6; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const isTotal = safeText(row.getCell(2).value) === "총 매출";
    row.height = isTotal ? 24 : 21;
    row.eachCell((cell, colNo) => {
      cell.border = isTotal ? borderStyle("366092") : borderStyle("D9E2F3");
      cell.alignment = { horizontal: colNo <= 2 ? "center" : "right", vertical: "middle", wrapText: false };
      if (isTotal) {
        cell.fill = fill(safeText(row.getCell(1).value) === "전체" ? COLORS.navy : COLORS.paleGreen);
        cell.font = { bold: true, color: { argb: safeText(row.getCell(1).value) === "전체" ? COLORS.white : COLORS.black } };
      } else if (r % 2 === 0) {
        cell.fill = fill("F8FAFD");
      }
    });
  }

  [3, 4, 8, 9, 13, 14].forEach(colNo => { ws.getColumn(colNo).numFmt = '#,##0.0'; });
  [6, 11, 16].forEach(colNo => { ws.getColumn(colNo).numFmt = '0.0%'; });
  [5, 7, 10, 12, 15, 17].forEach(colNo => { ws.getColumn(colNo).numFmt = '0'; });

  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: ws.rowCount, column: 17 } };
  setWidths(ws, [12, 12, 12, 12, 9, 12, 9, 12, 12, 9, 12, 9, 12, 12, 9, 12, 9]);
}

function styleReportCommentSheet(ws) {
  styleCommonSheet(ws, { headerRowNo: 1, headerFill: COLORS.green, autoFilter: true });
  setWidths(ws, [12, 12, 12, 12, 34, 34, 110]);
  ws.getColumn(3).numFmt = '#,##0.0';
  ws.getColumn(4).numFmt = '0.0%';
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const cell = ws.getRow(r).getCell(7);
    cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    ws.getRow(r).height = 132;
  }
}

function styleNumericSheet(ws, headerFill = COLORS.blue) {
  styleCommonSheet(ws, { headerRowNo: 1, headerFill, autoFilter: true });
  for (let c = 3; c <= ws.columnCount; c += 1) ws.getColumn(c).numFmt = '#,##0.0';
  const widths = Array.from({ length: ws.columnCount }, (_, idx) => idx < 2 ? 12 : 13);
  setWidths(ws, widths);
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
}

function styleCheckSheet(ws) {
  styleCommonSheet(ws, { headerRowNo: 1, headerFill: "6B7280", autoFilter: false });
  setWidths(ws, [18, 34, 40]);
}

function addWorksheetFromAoA(workbook, name, aoa) {
  const ws = workbook.addWorksheet(name);
  writeAoA(ws, aoa);
  return ws;
}

async function makeWorkbook(parsed, selectedMonth) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Costco Sales Auto Report";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const summary = buildSummaryAoA(parsed, selectedMonth);
  const reportCommentAoa = buildReportCommentAoa(parsed, summary.storeRows);
  const detail = buildDetailSheets(parsed);
  const modelTopAoa = buildModelTopAoa(parsed);
  const airconSetAoa = buildAirconSetAoa(parsed);
  const checkAoa = buildCheckSheet(parsed, selectedMonth);

  const wsSummary = addWorksheetFromAoA(workbook, "보고용_요약", summary.aoa);
  styleSummarySheet(wsSummary);

  const wsMent = addWorksheetFromAoA(workbook, "보고멘트", reportCommentAoa);
  styleReportCommentSheet(wsMent);

  const wsCe = addWorksheetFromAoA(workbook, "CE_품목별", detail.ceAoa);
  styleNumericSheet(wsCe, COLORS.blue);

  const wsMx = addWorksheetFromAoA(workbook, "MX_품목별", detail.mxAoa);
  styleNumericSheet(wsMx, COLORS.green);

  const wsModel = addWorksheetFromAoA(workbook, "모델_TOP", modelTopAoa);
  styleNumericSheet(wsModel, "44546A");
  wsModel.getColumn(6).numFmt = '#,##0.0';

  const wsAircon = addWorksheetFromAoA(workbook, "에어컨_세트별", airconSetAoa);
  styleNumericSheet(wsAircon, "0F766E");
  wsAircon.getColumn(4).numFmt = '#,##0';
  wsAircon.getColumn(5).numFmt = '#,##0.0';

  const wsGoal = addWorksheetFromAoA(workbook, "목표_확인", detail.goalAoa);
  styleNumericSheet(wsGoal, "70AD47");

  const wsCheck = addWorksheetFromAoA(workbook, "검증로그", checkAoa);
  styleCheckSheet(wsCheck);

  return workbook;
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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function previewNumber(value) {
  return toNumber(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function renderSummaryPreview(storeRows) {
  const panel = $("#summaryPreviewPanel");
  const target = $("#summaryPreview");
  if (!panel || !target) return;

  const headers = ["담당", "점포", "총 목표", "총 매출", "총 달성률", "CE 목표", "CE 매출", "CE 달성률", "MX 목표", "MX 매출", "MX 달성률"];
  const body = storeRows
    .filter(row => row.type === "store")
    .map(row => `
      <tr>
        <td>${row.manager}</td>
        <td>${row.store}</td>
        <td>${previewNumber(row.totalGoal)}</td>
        <td>${previewNumber(row.totalActual)}</td>
        <td>${ratePctText(row.totalRate)}</td>
        <td>${previewNumber(row.ceGoal)}</td>
        <td>${previewNumber(row.ceActual)}</td>
        <td>${ratePctText(row.ceRate)}</td>
        <td>${previewNumber(row.mxGoal)}</td>
        <td>${previewNumber(row.mxActual)}</td>
        <td>${ratePctText(row.mxRate)}</td>
      </tr>
    `).join("");

  target.innerHTML = `
    <table class="summary-table">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
  panel.hidden = false;
}

function copySummaryPreview() {
  const table = $("#summaryPreview table");
  if (!table) return;
  const rows = [...table.querySelectorAll("tr")].map(tr => [...tr.children].map(td => td.innerText).join("\t")).join("\n");
  navigator.clipboard?.writeText(rows);
  setStatus("매출 요약본 표를 클립보드에 복사했습니다.", "ok");
}

async function run() {
  try {
    setStatus("파일을 읽고 보고용 엑셀을 생성하고 있습니다...", "");
    if (typeof ExcelJS === "undefined") throw new Error("ExcelJS 라이브러리를 불러오지 못했습니다. 인터넷 연결 또는 CDN 차단 여부를 확인하세요.");

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
      ceModelByStore: zenielParsed.ceModelByStore,
      airconSetByStore: zenielParsed.airconSetByStore,
      mxByStore: mxParsed.mxByStore,
      mxByStoreCat: mxParsed.mxByStoreCat,
      mxModelByStore: mxParsed.mxModelByStore,
      goals: goalParsed.goals,
      zenielStats: zenielParsed.stats,
      mxStats: mxParsed.stats,
      goalStats: goalParsed.stats,
    };

    const previewRows = makeStoreRows(parsed);
    renderSummaryPreview(previewRows);

    const outWb = await makeWorkbook(parsed, selectedMonth);
    const outputNameRaw = safeText($("#outputName").value) || "코스트코_CE_MX_실적_자동취합.xlsx";
    const outputName = outputNameRaw.endsWith(".xlsx") ? outputNameRaw : `${outputNameRaw}.xlsx`;
    const buffer = await outWb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, outputName);

    const ceTotal = STORE_LIST.reduce((sum, store) => sum + wonToMillion(parsed.ceByStore[store]), 0);
    const mxTotal = STORE_LIST.reduce((sum, store) => sum + wonToMillion(parsed.mxByStore[store]), 0);

    setStatus(
      `완료되었습니다. CE ${ceTotal.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}백만원, MX ${mxTotal.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}백만원 기준으로 보고용 요약·보고멘트 시트를 생성했습니다.`,
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
  const panel = $("#summaryPreviewPanel");
  const target = $("#summaryPreview");
  if (panel) panel.hidden = true;
  if (target) target.innerHTML = "";
}

$("#runBtn").addEventListener("click", run);
$("#clearBtn").addEventListener("click", clearAll);
$("#copySummaryBtn")?.addEventListener("click", copySummaryPreview);
