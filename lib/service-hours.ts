export const SERVICE_TIME_ZONE = "America/Santo_Domingo";

export const SERVICE_HOURS_LABEL =
  "Lunes a viernes de 8:00 a. m. a 6:00 p. m.; sábados de 9:00 a. m. a 1:00 p. m.; domingos cerrado.";

type ServiceHoursCheck = {
  allowed: boolean;
  weekday: string;
  localMinutes: number;
  openMinutes: number | null;
  closeMinutes: number | null;
  reason: "open" | "outside_hours" | "closed_sunday" | "invalid_date";
};

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SERVICE_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return { weekday, localMinutes: hour * 60 + minute };
}

export function checkServiceHours(date: Date): ServiceHoursCheck {
  if (Number.isNaN(date.getTime())) {
    return {
      allowed: false,
      weekday: "",
      localMinutes: 0,
      openMinutes: null,
      closeMinutes: null,
      reason: "invalid_date",
    };
  }

  const { weekday, localMinutes } = localParts(date);

  if (weekday === "Sun") {
    return {
      allowed: false,
      weekday,
      localMinutes,
      openMinutes: null,
      closeMinutes: null,
      reason: "closed_sunday",
    };
  }

  const saturday = weekday === "Sat";
  const openMinutes = saturday ? 9 * 60 : 8 * 60;
  const closeMinutes = saturday ? 13 * 60 : 18 * 60;
  const allowed = localMinutes >= openMinutes && localMinutes <= closeMinutes;

  return {
    allowed,
    weekday,
    localMinutes,
    openMinutes,
    closeMinutes,
    reason: allowed ? "open" : "outside_hours",
  };
}

export function serviceHoursCustomerMessage() {
  return `Nuestro horario de servicio es ${SERVICE_HOURS_LABEL}`;
}
