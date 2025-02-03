Proof of concept of loading 40 000 000 time series data points into LightningChart JS without long loading times or interactivity breaking down.

Compared to direct approach of downloading all data to frontend up front, the data set is split to two versions:

- Full, raw data set (massive file).
- Aggregated much more coarse data set, that can give a good outline of the data but is ultimately false and can't be zoomed in a lot.

For good initial loading speed, first the aggregated data set is loaded ASAP (taking ~0.6 seconds).
To look better, the data is displayed with a Spline Series.
After the coarse data is displayed, the loading of the full, raw data set is started.
This takes quite a long time (~6.4 seconds).
After it is loaded, the line series data is smoothly replaced with a quick fade-out + fade-in animation.
Afterwards, the user can freely zoom in, zoom out and pan without any performance issues.

In this proof of concept, data set(s) are stored as [parquet](https://parquet.apache.org/) files, queried using [DuckDB Wasm](https://duckdb.org/docs/api/wasm/overview.html) and displayed using [LightningChart JS](https://lightningchart.com/js-charts).

**Result: The massive 40 000 000 points data set is loaded from a remote server and displayed in only 600 milliseconds. It becomes fully interactive and full resolution after 6 seconds.**

https://github.com/user-attachments/assets/47723a8d-efd3-4997-8d0b-f32776ce1878

Summary; LightningChart JS does not require user to use aggregation to load data into the charts. This is an example of storing data in both raw format as well as an aggregated copy to increase initial app load time and thus user experience.

Learn more at [lightningchart.com](https://lightningchart.com/js-charts).

## Running the application

```
cd data
(install python dependencies)
python create-parquet.py
npx http-server --cors --port=8086
```

```
cd frontend
npm i
npm start
```
