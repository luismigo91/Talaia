// Widget de Talaia para Scriptable (iOS) — pega este script en un widget de Scriptable.
// Muestra el nivel de riesgo de una localización, con su color y la lectura que manda.
//
// Configura arriba tu dominio y la localización. En "Parámetro" del widget puedes poner el id
// (virtual:albal, virtual:benetusser, virtual:mareny-barraquetes, virtual:benaguasil) para
// tener un widget por localidad.

const BASE = "https://talaia.luismi.dev";
const station = args.widgetParameter || "virtual:albal";

const COLOR = {
  verde: "#2f8f5a",
  amarillo: "#ad8210",
  naranja: "#c9691c",
  rojo: "#c0392b",
};

let data;
try {
  const url = `${BASE}/api/v1/risk/badge?station=${encodeURIComponent(station)}`;
  data = await new Request(url).loadJSON();
} catch (e) {
  data = {
    station: { name: station },
    level: "—",
    color: "#879898",
    reading: "sin conexión",
    updated: "",
  };
}

const w = new ListWidget();
w.backgroundColor = new Color("#ffffff");
w.setPadding(14, 16, 14, 16);

const name = w.addText(data.station.name);
name.font = Font.systemFont(13);
name.textColor = new Color("#56696a");

w.addSpacer(4);

const level = w.addText(String(data.level).toUpperCase());
level.font = Font.boldSystemFont(26);
level.textColor = new Color(COLOR[data.level] || "#879898");

w.addSpacer(2);
const reading = w.addText(data.reading || "");
reading.font = Font.systemFont(13);
reading.textColor = new Color("#10201f");

w.addSpacer();
const foot = w.addText(data.updated ? `actualizado ${data.updated}` : "");
foot.font = Font.systemFont(10);
foot.textColor = new Color("#879898");

// refresco cada ~10 min
w.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);

Script.setWidget(w);
w.presentSmall();
Script.complete();
