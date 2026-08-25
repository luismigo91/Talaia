/**
 * Mapa `EMMA_ID` de Meteoalarm → zona de aviso de AEMET.
 *
 * Meteoalarm reetiqueta las zonas de AEMET con identificadores propios, así que sin este mapa
 * no se puede saber si un aviso afecta a las localizaciones objetivo. Generado del propio feed
 * el 25-08-2026 y verificado cruzándolo con el código de zona que va dentro del `identifier`
 * del CAP: 128 zonas, cero conflictos.
 *
 * Para regenerarlo: descargar el feed y emparejar, por cada área, su `EMMA_ID` con el grupo
 * de seis dígitos del `identifier` (`/\.(\d{6})[A-Z]{2}/`).
 */
export const EMMA_TO_AEMET_ZONE: Record<string, string> = {
  ES070: "610401", // Valle del Almanzora y Los Vélez
  ES085: "612101", // Aracena
  ES086: "612102", // Andévalo y Condado
  ES087: "612103", // Litoral de Huelva
  ES096: "614101", // Sierra norte de Sevilla
  ES097: "614102", // Campiña sevillana
  ES099: "622201", // Pirineo oscense
  ES100: "622202", // Centro de Huesca
  ES101: "622203", // Sur de Huesca
  ES102: "624401", // Albarracín y Jiloca
  ES103: "624402", // Gúdar y Maestrazgo
  ES104: "624403", // Bajo Aragón de Teruel
  ES105: "625001", // Cinco Villas de Zaragoza
  ES106: "625002", // Ibérica zaragozana
  ES107: "625003", // Ribera del Ebro de Zaragoza
  ES108: "633301", // Litoral occidental asturiano
  ES109: "633302", // Litoral oriental asturiano
  ES110: "633303", // Suroccidental asturiana
  ES111: "633304", // Central y Valles Mineros
  ES113: "645301", // Ibiza y Formentera
  ES114: "645401", // Sierra Tramontana
  ES115: "645402", // Norte y nordeste de Mallorca
  ES116: "645403", // Interior de Mallorca
  ES117: "645404", // Sur de Mallorca
  ES118: "645405", // Levante mallorquín
  ES119: "645501", // Menorca
  ES133: "663901", // Litoral cántabro
  ES136: "663904", // Cantabria del Ebro
  ES137: "670501", // Meseta de Ávila
  ES138: "670502", // Sistema Central de Ávila
  ES139: "670503", // Sur de Ávila
  ES143: "670904", // Meseta de Burgos
  ES144: "670905", // Ibérica de Burgos
  ES145: "672401", // Cordillera Cantábrica de León
  ES146: "672402", // Bierzo de León
  ES147: "672403", // Meseta de León
  ES148: "673401", // Cordillera Cantábrica de Palencia
  ES149: "673402", // Meseta de Palencia
  ES150: "673701", // Meseta de Salamanca
  ES151: "673702", // Sistema Central de Salamanca
  ES152: "673703", // Sur de Salamanca
  ES153: "674001", // Meseta de Segovia
  ES154: "674002", // Sistema Central de Segovia
  ES155: "674201", // Ibérica de Soria
  ES156: "674202", // Meseta de Soria
  ES158: "674701", // Meseta de Valladolid
  ES159: "674901", // Sanabria
  ES160: "674902", // Meseta de Zamora
  ES161: "680201", // La Mancha albaceteña
  ES162: "680202", // Alcaraz y Segura
  ES164: "681301", // Montes del norte y Anchuras
  ES169: "681602", // Serranía de Cuenca
  ES172: "681902", // Parameras de Molina
  ES174: "684501", // Sierra de San Vicente
  ES175: "684502", // Valle del Tajo
  ES176: "684503", // Montes de Toledo
  ES178: "690801", // Prepirineo de Barcelona
  ES179: "690802", // Depresión central de Barcelona
  ES180: "690803", // Prelitoral de Barcelona
  ES181: "690804", // Litoral de Barcelona
  ES182: "691701", // Pirineo de Girona
  ES183: "691702", // Prelitoral de Girona
  ES184: "691703", // Ampurdán
  ES185: "691704", // Litoral sur de Girona
  ES186: "692501", // Valle de Arán
  ES187: "692502", // Pirineo de Lleida
  ES188: "692503", // Depresión central de Lleida
  ES189: "694301", // Depresión central de Tarragona
  ES190: "694302", // Prelitoral norte de Tarragona
  ES191: "694303", // Litoral norte de Tarragona
  ES192: "694304", // Litoral sur de Tarragona
  ES193: "694305", // Prelitoral sur de Tarragona
  ES194: "700601", // Vegas del Guadiana
  ES195: "700602", // La Siberia extremeña
  ES196: "700603", // Barros y Serena
  ES197: "700604", // Sur de Badajoz
  ES198: "701001", // Norte de Cáceres
  ES199: "701002", // Tajo y Alagón
  ES200: "701003", // Meseta cacereña
  ES201: "701004", // Villuercas y Montánchez
  ES202: "711501", // Noroeste de A Coruña
  ES203: "711502", // Oeste de A Coruña
  ES204: "711503", // Interior de A Coruña
  ES205: "711504", // Suroeste de A Coruña
  ES206: "712701", // A Mariña
  ES207: "712702", // Centro de Lugo
  ES209: "712704", // Sur de Lugo
  ES210: "713201", // Noroeste de Ourense
  ES211: "713202", // Miño de Ourense
  ES212: "713203", // Sur de Ourense
  ES213: "713204", // Montaña de Ourense
  ES214: "713205", // Valdeorras
  ES215: "713601", // Rias Baixas
  ES216: "713602", // Interior de Pontevedra
  ES217: "713603", // Miño de Pontevedra
  ES221: "733001", // Altiplano de Murcia
  ES222: "733002", // Noroeste de Murcia
  ES223: "733003", // Vega del Segura
  ES226: "743101", // Vertiente cantábrica de Navarra
  ES227: "743102", // Centro de Navarra
  ES228: "743103", // Pirineo navarro
  ES229: "743104", // Ribera del Ebro de Navarra
  ES233: "752001", // Gipuzkoa litoral
  ES234: "752002", // Gipuzkoa interior
  ES235: "754801", // Bizkaia litoral
  ES236: "754802", // Bizkaia interior
  ES237: "762601", // Ribera del Ebro de La Rioja
  ES238: "762602", // Ibérica riojana
  ES243: "771202", // Litoral norte de Castellón
  ES244: "771203", // Interior sur de Castellón
  ES245: "771204", // Litoral sur de Castellón
  ES246: "774601", // Interior norte de Valencia
  ES247: "774602", // Litoral norte de Valencia
  ES249: "774604", // Litoral sur de Valencia
  ES861: "770303", // Costa - Litoral sur de Alicante
  ES862: "770301", // Costa - Litoral norte de Alicante
  ES863: "774604", // Costa - Litoral sur de Valencia
  ES864: "774602", // Costa - Litoral norte de Valencia
  ES865: "771204", // Costa - Litoral sur de Castellón
  ES866: "771202", // Costa - Litoral norte de Castellón
  ES867: "694304", // Costa - Litoral sur de Tarragona
  ES868: "694303", // Costa - Litoral norte de Tarragona
  ES873: "645301", // Costa - Ibiza y Formentera
  ES874: "645404", // Costa - Sur de Mallorca
  ES875: "645401", // Costa - Sierra Tramontana
  ES876: "645402", // Costa - Norte y nordeste de Mallorca
  ES877: "645405", // Costa - Levante mallorquín
  ES878: "645501", // Costa - Menorca
};

/** Zona de aviso de AEMET incrustada en el `identifier` del CAP, si la lleva. */
export function zoneFromIdentifier(identifier: string): string | undefined {
  return /\.(\d{6})[A-Z]{2}/.exec(identifier)?.[1];
}
