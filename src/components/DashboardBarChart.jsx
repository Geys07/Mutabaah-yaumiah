import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";

export default function DashboardBarChart({
  type = "bar",
  data,
  options,
  height = 220,
  onItemClick,
  label = "Grafik",
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const lastDataRef = useRef(null);
  const lastOptionsRef = useRef(null);
  const onItemClickRef = useRef(onItemClick);
  const [visible, setVisible] = useState(false);

  onItemClickRef.current = onItemClick;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.15, rootMargin: "0px 0px -24px 0px" });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvasRef.current || chartRef.current) return undefined;

    const chart = new Chart(canvasRef.current, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 750,
          easing: "easeOutQuart",
        },
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "rectRounded",
              boxWidth: 8,
              boxHeight: 8,
              padding: 16,
              color: "#748176",
              font: { family: "Arial, sans-serif", size: 11 },
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: "#173d2e",
            titleColor: "#ffffff",
            bodyColor: "#e4f0e8",
            padding: 10,
            cornerRadius: 8,
            displayColors: true,
          },
        },
        ...options,
        onClick: (event, activeElements, chartInstance) => {
          const index = activeElements?.[0]?.index;
          if (Number.isInteger(index)) onItemClickRef.current?.(index, chartInstance);
        },
      },
    });

    chartRef.current = chart;
    lastDataRef.current = data;
    lastOptionsRef.current = options;
    return () => {
      chart.destroy();
      chartRef.current = null;
      lastDataRef.current = null;
      lastOptionsRef.current = null;
    };
  }, [visible, type]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (lastDataRef.current === data && lastOptionsRef.current === options) return;
    chart.data = data;
    lastDataRef.current = data;
    lastOptionsRef.current = options;
    chart.options = {
      ...chart.options,
      ...options,
    };
    chart.update("none");
  }, [data, options, visible]);

  return (
    <div className="live-chart-canvas" style={{ height }} role="img" aria-label={label}>
      <canvas ref={canvasRef} />
    </div>
  );
}
