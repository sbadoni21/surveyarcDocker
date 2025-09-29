
export const calculateDueDateWithBusinessHours = (minutes, businessCalendar = null) => {
  if (!minutes) return null;
  
  const now = new Date();
  
  // If no calendar or no working hours defined, use simple calculation
  if (!businessCalendar?.working_hours) {
    return new Date(now.getTime() + (minutes * 60 * 1000)).toISOString();
  }
  
  let remainingMinutes = minutes;
  let currentDate = new Date(now);
  
  const workingHours = businessCalendar.working_hours;
  const workingDays = businessCalendar.working_days || [1, 2, 3, 4, 5]; // Mon-Fri
  const holidays = businessCalendar.holidays || [];
  
  while (remainingMinutes > 0) {
    const dayOfWeek = currentDate.getDay();
    const currentDateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Skip holidays
    if (holidays.some(holiday => holiday.date === currentDateStr)) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
      continue;
    }
    
    // Skip non-working days
    if (!workingDays.includes(dayOfWeek)) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
      continue;
    }
    
    const timeOfDay = currentDate.getHours() * 60 + currentDate.getMinutes();
    const workStart = (workingHours.start_hour || 9) * 60 + (workingHours.start_minute || 0);
    const workEnd = (workingHours.end_hour || 17) * 60 + (workingHours.end_minute || 0);
    
    // If before work hours, jump to start of work day
    if (timeOfDay < workStart) {
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
      continue;
    }
    
    // If after work hours, jump to next work day
    if (timeOfDay >= workEnd) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
      continue;
    }
    
    // Calculate minutes available in current work day
    const minutesLeftInWorkDay = workEnd - timeOfDay;
    const minutesToAdd = Math.min(remainingMinutes, minutesLeftInWorkDay);
    
    currentDate.setMinutes(currentDate.getMinutes() + minutesToAdd);
    remainingMinutes -= minutesToAdd;
    
    // If we still have minutes left, move to next work day
    if (remainingMinutes > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(workingHours.start_hour || 9, workingHours.start_minute || 0, 0, 0);
    }
  }
  
  return currentDate.toISOString();
};