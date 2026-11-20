import type { DestinationForecast } from '../models/hazard';

/** Destination forecast for today from MET Malaysia, in Malay as published: "Petang: Ribut petir di beberapa tempat". */
export function WeatherChip({ forecast }: { forecast: DestinationForecast }) {
  const rainy = /hujan|ribut/i.test(forecast.summary);
  const temps = forecast.minTemp !== null && forecast.maxTemp !== null ? ` · ${forecast.minTemp}–${forecast.maxTemp}°C` : '';
  return (
    <div
      className="nn-weatherchip"
      title={`MET Malaysia forecast for ${forecast.locationName} today. Pagi: ${forecast.morning}. Petang: ${forecast.afternoon}. Malam: ${forecast.night}.`}
    >
      <span aria-hidden="true">{rainy ? '🌦️' : '⛅'}</span>
      <span className="nn-weatherchip__text">
        {forecast.locationName}
        {forecast.summaryWhen ? ` · ${forecast.summaryWhen}` : ''}: {forecast.summary}
        {temps}
      </span>
      <span className="nn-weatherchip__src">MET</span>
    </div>
  );
}
