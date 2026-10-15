import { useCallback, useReducer } from "react";

const LIMIT = 60;

function reducer(state, action) {
  switch (action.type) {
    /** Simpan kondisi sekarang ke riwayat (dipanggil SEBELUM sebuah perubahan/gesture). */
    case "snapshot":
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: state.present,
        future: [],
      };

    /** Ubah kondisi sekarang tanpa menyentuh riwayat (dipakai saat drag). */
    case "set": {
      const present =
        typeof action.value === "function" ? action.value(state.present) : action.value;
      return present === state.present ? state : { ...state, present };
    }

    /** Gesture selesai tanpa perubahan -> buang snapshot yang tadi dibuat. */
    case "settle":
      return state.past.length > 0 && state.past[state.past.length - 1] === state.present
        ? { ...state, past: state.past.slice(0, -1) }
        : state;

    case "undo": {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
    }

    default:
      return state;
  }
}

/**
 * Daftar stiker + undo/redo.
 *  - commit(value): perubahan sekali jalan (tambah, hapus, layer) -> otomatis masuk riwayat
 *  - snapshot() + set(value) + settle(): untuk gesture kontinu (drag, slider)
 */
export function useStickerHistory(initial) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initial, future: [] });

  const snapshot = useCallback(() => dispatch({ type: "snapshot" }), []);
  const set = useCallback((value) => dispatch({ type: "set", value }), []);
  const settle = useCallback(() => dispatch({ type: "settle" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const commit = useCallback((value) => {
    dispatch({ type: "snapshot" });
    dispatch({ type: "set", value });
  }, []);

  return {
    stickers: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    snapshot,
    set,
    settle,
    commit,
    undo,
    redo,
  };
}
