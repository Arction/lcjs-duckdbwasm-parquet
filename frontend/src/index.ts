import * as duckdb from "@duckdb/duckdb-wasm";
import { DuckDBDataProtocol } from "@duckdb/duckdb-wasm";
import {
  Axis,
  AxisTickStrategies,
  emptyFill,
  isSolidFill,
  lightningChart,
  PointLineAreaSeries,
} from "@lightningchart/lcjs";

//
// Generic chart logic for displaying incoming multi-channel time series data in stacked line charts
//
const chartDisplayLogic = (() => {
  const lc = lightningChart({
    license: "", // License goes here
  });
  const chart = lc
    .ChartXY({
      defaultAxisX: { type: "linear-highPrecision" },
      animationsEnabled: false,
    })
    .setTitle("Click on title to load data");
  chart.axisX
    .setTickStrategy(AxisTickStrategies.DateTime)
    .setTitle(`10 million data points`);
  chart.axisY.dispose();
  const channels: {
    [key: string]: {
      seriesAggregated?: PointLineAreaSeries;
      seriesRaw?: PointLineAreaSeries;
      axisY: Axis;
    };
  } = {};
  const handleIncomingData = (
    channelName: string,
    isAggregated: boolean,
    timestamps: Float64Array,
    values: Float64Array,
    totalDataSetSize: number
  ) => {
    if (!channels[channelName]) {
      const axisY = chart
        .addAxisY({ iStack: -Object.keys(channels).length })
        .setMargins(10, 10);
      const ch = {
        axisY,
      };
      channels[channelName] = ch;
    }
    const ch = channels[channelName];
    let series: PointLineAreaSeries = isAggregated
      ? ch.seriesAggregated
      : ch.seriesRaw;
    if (isAggregated && !series) {
      ch.seriesAggregated = series = chart
        .addPointLineAreaSeries({
          dataPattern: "ProgressiveX",
          axisY: ch.axisY,
          automaticColorIndex: Object.keys(channels).indexOf(channelName),
        })
        .setAreaFillStyle(emptyFill)
        .setMaxSampleCount(totalDataSetSize)
        .setCurvePreprocessing({ type: "spline" });
    }
    if (!isAggregated && !series) {
      ch.seriesRaw = series = chart
        .addPointLineAreaSeries({
          dataPattern: "ProgressiveX",
          axisY: ch.axisY,
          automaticColorIndex: Object.keys(channels).indexOf(channelName),
        })
        .setStrokeStyle((stroke) =>
          stroke.setFillStyle((fill) => isSolidFill(fill) && fill.setA(0))
        )
        .setAreaFillStyle(emptyFill)
        .setMaxSampleCount(totalDataSetSize);
      // Animation to replace aggregated series with raw series
      let tStart: number | undefined;
      const seriesAggregated = ch.seriesAggregated as PointLineAreaSeries;
      const seriesRaw = ch.seriesRaw;
      seriesAggregated.setCursorEnabled(false);
      const anim = () => {
        tStart = tStart ?? performance.now();
        const pos = (performance.now() - tStart) / 1000;
        seriesAggregated.setStrokeStyle((stroke) =>
          stroke.setFillStyle(
            (fill) => isSolidFill(fill) && fill.setA(255 * (1 - pos))
          )
        );
        seriesRaw.setStrokeStyle((stroke) =>
          stroke.setFillStyle(
            (fill) => isSolidFill(fill) && fill.setA(255 * pos)
          )
        );
        if (pos < 1) requestAnimationFrame(anim);
        else {
          seriesAggregated.dispose();
          ch.seriesAggregated = undefined;
        }
      };
      requestAnimationFrame(anim);
    }
    series.appendSamples({
      xValues: timestamps,
      yValues: values,
    });
  };
  return {
    handleIncomingData,
    chart,
  };
})();

//
// Data connection part - duckdb wasm, first load aggregated parquet file, then load full raw parquet file for same data
//
const getDb = async () => {
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: "text/javascript",
    })
  );
  // Instantiate the asynchronus version of DuckDB-wasm
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);
  return db;
};

(async () => {
  const db = await getDb();
  console.log(db);
  await db.registerFileURL(
    "test_data",
    "http://localhost:8086/test_data.parquet",
    DuckDBDataProtocol.HTTP,
    false
  );
  await db.registerFileURL(
    "test_data_aggregated",
    "http://localhost:8086/test_data_aggregated.parquet",
    DuckDBDataProtocol.HTTP,
    false
  );
  const conn = await db.connect();

  const handleClick = () => {
    chartDisplayLogic.chart.title.removeEventListener("click", handleClick);
    runTest();
  };
  chartDisplayLogic.chart.title.addEventListener("click", handleClick);

  const runTest = async () => {
    const tStartLoadAggregated = performance.now();
    console.time("query data aggregated");
    const resultsAggregated = await conn.query(
      `SELECT *
      FROM parquet_scan('test_data_aggregated');
      `
    );
    console.timeEnd("query data aggregated");
    console.log(
      resultsAggregated.numRows,
      "rows",
      resultsAggregated.numCols,
      "cols"
    );
    console.time("display data aggregated");
    resultsAggregated.batches.forEach((batch) => {
      const iFieldTimestamp = batch.schema.fields.findIndex(
        (item) => item.name === "timestamp"
      );
      const dataTimestamps = bigInt64ArrayToFloat64Array(
        batch.getChildAt(iFieldTimestamp).toArray()
      ).map((timestamp) => timestamp / 1000_000);
      batch.schema.fields.forEach((field, index) => {
        const channelName = field.name;
        if (channelName === "timestamp") return;
        const columnData = bigInt64ArrayToFloat64Array(
          batch.getChildAt(index).toArray()
        );
        chartDisplayLogic.handleIncomingData(
          channelName,
          true,
          dataTimestamps,
          columnData,
          resultsAggregated.numRows
        );
      });
    });
    requestAnimationFrame(async () => {
      console.timeEnd("display data aggregated");
      const tFinishLoadAggregated = performance.now();
      chartDisplayLogic.chart.setTitle(
        `Aggregated data visible in ${(
          tFinishLoadAggregated - tStartLoadAggregated
        ).toFixed(0)} milliseconds`
      );
      // Query raw data
      console.time("query data raw");
      const resultsRaw = await conn.query(
        `SELECT *
      FROM parquet_scan('test_data');
      `
      );
      console.timeEnd("query data raw");
      console.log(resultsRaw.numRows, "rows", resultsRaw.numCols, "cols");
      console.time("display data raw");
      resultsRaw.batches.forEach((batch) => {
        const iFieldTimestamp = batch.schema.fields.findIndex(
          (item) => item.name === "timestamp"
        );
        const dataTimestamps = bigInt64ArrayToFloat64Array(
          batch.getChildAt(iFieldTimestamp).toArray()
        ).map((timestamp) => timestamp / 1000_000);
        batch.schema.fields.forEach((field, index) => {
          const channelName = field.name;
          if (channelName === "timestamp") return;
          const columnData = bigInt64ArrayToFloat64Array(
            batch.getChildAt(index).toArray()
          );
          chartDisplayLogic.handleIncomingData(
            channelName,
            false,
            dataTimestamps,
            columnData,
            resultsRaw.numRows
          );
        });
      });
      requestAnimationFrame(() => {
        console.timeEnd("display data raw");
        const tFinishLoadRaw = performance.now();
        chartDisplayLogic.chart.setTitle(
          `Complete raw data set interactable after ${(
            (tFinishLoadRaw - tStartLoadAggregated) /
            1000
          ).toFixed(1)} seconds`
        );
      });
    });
  };
})();

const bigInt64ArrayToFloat64Array = (arr: BigInt64Array): Float64Array => {
  const len = arr.length;
  const out = new Float64Array(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = Number(arr[i]);
  }
  return out;
};
