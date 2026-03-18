import { writable } from "svelte/store";

function createDarkModeStore() {
  const storedValue = typeof localStorage !== 'undefined' ? localStorage.getItem('darkMode') : null;
  const { set, subscribe, update } = writable<"light" | "dark">(storedValue as "light" | "dark" || "dark");

  return {
    set: (value: "light" | "dark") => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('darkMode', value);
      }
      set(value);
    },
    subscribe,
    toggle: () => {
      update((_) => {
        const newValue = _ === "dark" ? "light" : "dark";
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('darkMode', newValue);
        }
        return newValue;
      });
    },
  };
}

export const darkMode = createDarkModeStore();
