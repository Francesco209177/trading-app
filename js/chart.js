/* ============================================================
   Il grafico dell'andamento (libreria Lightweight Charts di TradingView).

   Una sola area: il valore del portafoglio nel tempo. Verde se il
   periodo mostrato è in guadagno, rosso se in perdita.
   Toccando il grafico si "scorre" nel tempo e il numero grande in
   alto mostra quanto valeva in quel momento.
   ============================================================ */

const Chart = (() => {
  let chart = null;
  let series = null;
  let box = null;
  let onScrub = () => {};

  const COLORS = {
    up: { line: "#21c77a", top: "rgba(33,199,122,.28)", bottom: "rgba(33,199,122,0)" },
    down: { line: "#ff5f5f", top: "rgba(255,95,95,.24)", bottom: "rgba(255,95,95,0)" },
  };

  // La libreria è alla versione 5, ma teniamo la compatibilità con la 4:
  // cambia solo il modo di aggiungere la serie.
  function addArea(options) {
    if (typeof chart.addAreaSeries === "function") return chart.addAreaSeries(options);
    return chart.addSeries(LightweightCharts.AreaSeries, options);
  }

  function create(element, handlers) {
    box = element;
    onScrub = (handlers && handlers.onScrub) || onScrub;

    chart = LightweightCharts.createChart(element, {
      width: element.clientWidth,
      height: element.clientHeight || 210,
      autoSize: false,
      layout: {
        background: { color: "transparent" },
        textColor: "#8b93a7",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#1a1f2b" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.2, bottom: 0.12 } },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        // La libreria dice già che tipo di tacca sta disegnando:
        // 0 anno, 1 mese, 2 giorno, 3 ora. Così le date restano date
        // anche se in Italia la mezzanotte di Londra sono le 02:00.
        tickMarkFormatter: (time, tickType) => {
          const d = new Date(time * 1000);
          if (tickType === 0) return String(d.getFullYear());
          if (tickType === 1) return d.toLocaleDateString("it-IT", { month: "short" });
          if (tickType === 2) return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
          return Fmt.time(d);
        },
      },
      crosshair: {
        mode: 0, // libero: segue il dito anche tra due punti
        vertLine: { color: "#3a4459", width: 1, style: 3, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
      localization: {
        locale: "it-IT",
        priceFormatter: (v) => Fmt.money(v),
        timeFormatter: (t) => Fmt.dateTime(new Date(t * 1000)),
      },
    });

    series = addArea({
      lineWidth: 2,
      lineColor: COLORS.up.line,
      topColor: COLORS.up.top,
      bottomColor: COLORS.up.bottom,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: "#0b0d12",
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.point) return onScrub(null);
      const point = param.seriesData.get(series);
      onScrub(point ? { time: param.time, value: point.value } : null);
    });

    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (box.clientWidth) chart.applyOptions({ width: box.clientWidth });
      }).observe(box);
    } else {
      window.addEventListener("resize", () => chart.applyOptions({ width: box.clientWidth }));
    }
  }

  function setData(points) {
    if (!series) return;
    const first = points.length ? points[0].value : 0;
    const last = points.length ? points[points.length - 1].value : 0;
    const palette = last >= first ? COLORS.up : COLORS.down;
    series.applyOptions({
      lineColor: palette.line,
      topColor: palette.top,
      bottomColor: palette.bottom,
    });
    series.setData(points);
    chart.timeScale().fitContent();
  }

  // Sposta solo l'ultimo punto: è quello che pulsa col prezzo.
  function updateLast(time, value) {
    if (!series) return;
    series.update({ time, value: Math.round(value * 100) / 100 });
  }

  return { create, setData, updateLast, get ready() { return !!series; } };
})();
