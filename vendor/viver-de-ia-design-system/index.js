import { cloneElement as e, createContext as t, forwardRef as n, isValidElement as r, useCallback as i, useContext as a, useEffect as o, useId as s, useMemo as c, useRef as l, useState as u } from "react";
import { Fragment as d, jsx as f, jsxs as p } from "react/jsx-runtime";
import { AlertCircle as m, AlertTriangle as h, Calendar as g, Check as _, ChevronDown as v, ChevronLeft as y, ChevronRight as b, ChevronUp as x, Clock as S, CornerDownLeft as C, Download as w, Info as T, Minus as E, Pipette as D, Search as O, X as k } from "lucide-react";
//#region src/lib/Button/Button.tsx
var A = n(({ variant: e = "primary", size: t = "md", iconLeft: n, iconRight: r, loading: i, fullWidth: a, disabled: o, className: s = "", children: c, ...l }, u) => /* @__PURE__ */ p("button", {
	ref: u,
	type: "button",
	className: [
		"via-btn",
		`via-btn--${e}`,
		`via-btn--${t}`,
		a && "via-btn--full",
		i && "via-btn--loading",
		s
	].filter(Boolean).join(" "),
	disabled: o || i,
	"aria-busy": i || void 0,
	...l,
	children: [
		n && /* @__PURE__ */ f("span", {
			className: "via-btn__icon",
			children: n
		}),
		i ? /* @__PURE__ */ f("span", {
			className: "via-btn__spinner",
			"aria-hidden": "true"
		}) : null,
		/* @__PURE__ */ f("span", {
			className: "via-btn__label",
			children: c
		}),
		r && /* @__PURE__ */ f("span", {
			className: "via-btn__icon",
			children: r
		})
	]
}));
A.displayName = "Button";
//#endregion
//#region src/lib/Pill/Pill.tsx
var j = n(({ variant: e = "default", size: t = "md", iconLeft: n, className: r = "", children: i, ...a }, o) => {
	let s = [
		"via-pill",
		`via-pill--${e}`,
		`via-pill--${t}`,
		r
	].filter(Boolean).join(" ");
	return e === "live" ? /* @__PURE__ */ p("span", {
		ref: o,
		className: s,
		...a,
		children: [/* @__PURE__ */ f("span", {
			className: "via-pill__live-dot",
			"aria-hidden": "true"
		}), /* @__PURE__ */ f("em", { children: i })]
	}) : /* @__PURE__ */ p("span", {
		ref: o,
		className: s,
		...a,
		children: [n && /* @__PURE__ */ f("span", {
			className: "via-pill__icon",
			children: n
		}), i]
	});
});
j.displayName = "Pill";
//#endregion
//#region src/lib/Card/Card.tsx
var M = n(({ variant: e = "default", as: t = "article", hoverable: n = !1, noPadding: r = !1, className: i = "", children: a, ...o }, s) => /* @__PURE__ */ f(t, {
	ref: s,
	className: [
		"via-card",
		`via-card--${e}`,
		n && "via-card--hoverable",
		r && "via-card--no-padding",
		i
	].filter(Boolean).join(" "),
	...o,
	children: a
}));
M.displayName = "Card";
//#endregion
//#region src/lib/Input/Input.tsx
var N = n(({ variant: e = "default", size: t = "md", iconLeft: n, iconRight: r, label: i, hint: a, error: o, className: s = "", id: c, ...l }, u) => {
	let d = c || `via-input-${Math.random().toString(36).slice(2, 9)}`, m = [
		"via-input",
		`via-input--${o ? "error" : e}`,
		`via-input--${t}`,
		s
	].filter(Boolean).join(" ");
	return /* @__PURE__ */ p("div", {
		className: "via-input-wrap",
		children: [
			i && /* @__PURE__ */ f("label", {
				htmlFor: d,
				className: "via-input__label",
				children: i
			}),
			/* @__PURE__ */ p("div", {
				className: m,
				children: [
					n && /* @__PURE__ */ f("span", {
						className: "via-input__icon",
						children: n
					}),
					/* @__PURE__ */ f("input", {
						ref: u,
						id: d,
						"aria-invalid": !!o,
						"aria-describedby": o || a ? `${d}-msg` : void 0,
						...l
					}),
					r && /* @__PURE__ */ f("span", {
						className: "via-input__icon",
						children: r
					})
				]
			}),
			(o || a) && /* @__PURE__ */ f("p", {
				id: `${d}-msg`,
				className: `via-input__msg ${o ? "via-input__msg--error" : ""}`,
				children: o || a
			})
		]
	});
});
N.displayName = "Input";
//#endregion
//#region src/lib/Avatar/Avatar.tsx
function P(e) {
	return e ? e.split(" ").filter(Boolean).slice(0, 2).map((e) => e[0]?.toUpperCase()).join("") : "?";
}
var F = n(({ src: e, alt: t, initials: n, size: r = "md", status: i, className: a = "", ...o }, s) => {
	let c = n || P(t);
	return /* @__PURE__ */ p("span", {
		ref: s,
		className: [
			"via-avatar",
			`via-avatar--${r}`,
			a
		].filter(Boolean).join(" "),
		role: "img",
		"aria-label": t || c,
		...o,
		children: [e ? /* @__PURE__ */ f("img", {
			src: e,
			alt: t || c
		}) : /* @__PURE__ */ f("span", {
			className: "via-avatar__initials",
			children: c
		}), i && /* @__PURE__ */ f("span", {
			className: `via-avatar__status via-avatar__status--${i}`,
			"aria-hidden": "true"
		})]
	});
});
F.displayName = "Avatar";
//#endregion
//#region src/lib/Icon/Icon.tsx
var I = n(({ children: e, size: t = "md", tone: n = "default", surface: r = "none", label: i, className: a = "", ...o }, s) => /* @__PURE__ */ f("span", {
	ref: s,
	className: [
		"via-icon",
		`via-icon--${t}`,
		`via-icon--tone-${n}`,
		r !== "none" && `via-icon--surface-${r}`,
		a
	].filter(Boolean).join(" "),
	"aria-label": i,
	"aria-hidden": i ? void 0 : !0,
	...o,
	children: e
}));
I.displayName = "Icon";
//#endregion
//#region src/lib/Toast/Toast.tsx
var L = {
	default: /* @__PURE__ */ f(T, {
		size: 14,
		strokeWidth: 2
	}),
	success: /* @__PURE__ */ f(_, {
		size: 14,
		strokeWidth: 2.4
	}),
	warning: /* @__PURE__ */ f(m, {
		size: 14,
		strokeWidth: 2
	}),
	destructive: /* @__PURE__ */ f(m, {
		size: 14,
		strokeWidth: 2
	})
};
function R({ toast: e, onDismiss: t }) {
	let n = e.variant ?? "default", r = e.duration ?? 4500;
	return o(() => {
		if (r <= 0) return;
		let n = setTimeout(() => t(e.id), r);
		return () => clearTimeout(n);
	}, [
		r,
		e.id,
		t
	]), /* @__PURE__ */ p("div", {
		className: `via-toast via-toast--${n}`,
		role: "status",
		"aria-live": "polite",
		children: [
			/* @__PURE__ */ f("span", {
				className: "via-toast__icon",
				children: L[n]
			}),
			/* @__PURE__ */ p("div", {
				className: "via-toast__body",
				children: [/* @__PURE__ */ f("strong", { children: e.title }), e.message && /* @__PURE__ */ f("p", { children: e.message })]
			}),
			e.action && /* @__PURE__ */ f("button", {
				type: "button",
				className: "via-toast__action",
				onClick: e.action.onClick,
				children: e.action.label
			}),
			/* @__PURE__ */ f("button", {
				type: "button",
				className: "via-toast__close",
				onClick: () => t(e.id),
				"aria-label": "Fechar notificação",
				children: /* @__PURE__ */ f(k, {
					size: 12,
					strokeWidth: 2.4
				})
			})
		]
	});
}
function z({ toasts: e, onDismiss: t, position: n = "top-right" }) {
	return /* @__PURE__ */ f("div", {
		className: `via-toast-stack via-toast-stack--${n}`,
		role: "region",
		"aria-label": "Notificações",
		children: e.map((e) => /* @__PURE__ */ f(R, {
			toast: e,
			onDismiss: t
		}, e.id))
	});
}
//#endregion
//#region src/lib/Toast/useToasts.ts
function B() {
	let [e, t] = u([]);
	return {
		toasts: e,
		push: i((e) => {
			let n = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
			return t((t) => [...t, {
				...e,
				id: n
			}]), n;
		}, []),
		dismiss: i((e) => {
			t((t) => t.filter((t) => t.id !== e));
		}, []),
		clear: i(() => t([]), [])
	};
}
//#endregion
//#region src/lib/Tooltip/Tooltip.tsx
function V({ content: t, children: n, side: i = "top", delay: a = 200 }) {
	let [c, d] = u(!1), m = l(null), h = s(), g = () => {
		m.current && clearTimeout(m.current), m.current = setTimeout(() => d(!0), a);
	}, _ = () => {
		m.current && clearTimeout(m.current), d(!1);
	}, v = (e) => {
		e.key === "Escape" && c && (e.stopPropagation(), _());
	};
	o(() => () => {
		m.current && clearTimeout(m.current);
	}, []);
	let y = n;
	if (r(n)) {
		let t = n, r = t.props["aria-describedby"];
		y = e(t, { "aria-describedby": c ? [r, h].filter(Boolean).join(" ") : r });
	}
	return /* @__PURE__ */ p("span", {
		className: "via-tooltip-wrap",
		onMouseEnter: g,
		onMouseLeave: _,
		onFocus: g,
		onBlur: _,
		onKeyDown: v,
		children: [y, c && /* @__PURE__ */ f("span", {
			id: h,
			role: "tooltip",
			className: `via-tooltip via-tooltip--${i}`,
			children: t
		})]
	});
}
//#endregion
//#region src/lib/_shared/useDialogFocus.ts
var H = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";
function U(e, t) {
	let n = l(null);
	return o(() => {
		if (e) return n.current = document.activeElement, () => {
			n.current?.focus?.();
		};
	}, [e]), o(() => {
		!e || !t.current || (t.current.querySelector(H) ?? t.current).focus();
	}, [e, t]), { onKeyDown: (e) => {
		if (e.key !== "Tab" || !t.current) return;
		let n = Array.from(t.current.querySelectorAll(H));
		if (n.length === 0) {
			e.preventDefault(), t.current.focus();
			return;
		}
		let r = n[0], i = n[n.length - 1], a = document.activeElement;
		e.shiftKey ? (a === r || !t.current.contains(a)) && (e.preventDefault(), i.focus()) : (a === i || !t.current.contains(a)) && (e.preventDefault(), r.focus());
	} };
}
//#endregion
//#region src/lib/Modal/Modal.tsx
function W({ open: e, onClose: t, title: n, description: r, size: i = "md", children: a, footer: c, hideClose: u = !1, scrim: d = !0 }) {
	let m = l(null), h = s();
	o(() => {
		if (!e) return;
		let n = (e) => e.key === "Escape" && t();
		document.addEventListener("keydown", n);
		let r = document.body.style.overflow;
		return document.body.style.overflow = "hidden", () => {
			document.removeEventListener("keydown", n), document.body.style.overflow = r;
		};
	}, [e, t]);
	let { onKeyDown: g } = U(e, m);
	return e ? /* @__PURE__ */ p("div", {
		className: "via-modal-root",
		role: "presentation",
		children: [d && /* @__PURE__ */ f("div", {
			className: "via-modal-scrim",
			onClick: t,
			"aria-hidden": "true"
		}), /* @__PURE__ */ p("div", {
			ref: m,
			className: `via-modal via-modal--${i}`,
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": n ? h : void 0,
			tabIndex: -1,
			onKeyDown: g,
			children: [
				(n || !u) && /* @__PURE__ */ p("header", {
					className: "via-modal__head",
					children: [/* @__PURE__ */ p("div", { children: [n && /* @__PURE__ */ f("h2", {
						id: h,
						children: n
					}), r && /* @__PURE__ */ f("p", { children: r })] }), !u && /* @__PURE__ */ f("button", {
						type: "button",
						className: "via-modal__close",
						onClick: t,
						"aria-label": "Fechar diálogo",
						children: /* @__PURE__ */ f(k, {
							size: 14,
							strokeWidth: 2.2
						})
					})]
				}),
				/* @__PURE__ */ f("div", {
					className: "via-modal__body",
					children: a
				}),
				c && /* @__PURE__ */ f("footer", {
					className: "via-modal__foot",
					children: c
				})
			]
		})]
	}) : null;
}
//#endregion
//#region src/lib/Tabs/Tabs.tsx
function ee({ items: e, defaultActiveId: t, activeId: n, onChange: r, variant: i = "underline", className: a = "" }) {
	let o = s(), [c, l] = u(t ?? e[0]?.id ?? ""), d = n ?? c, m = (e) => {
		n === void 0 && l(e), r?.(e);
	}, h = (t, n) => {
		if (t.key !== "ArrowRight" && t.key !== "ArrowLeft" && t.key !== "Home" && t.key !== "End") return;
		t.preventDefault();
		let r = n;
		t.key === "ArrowRight" && (r = (n + 1) % e.length), t.key === "ArrowLeft" && (r = (n - 1 + e.length) % e.length), t.key === "Home" && (r = 0), t.key === "End" && (r = e.length - 1), m(e[r].id), document.getElementById(`${o}-tab-${e[r].id}`)?.focus();
	};
	return /* @__PURE__ */ p("div", {
		className: `via-tabs via-tabs--${i} ${a}`,
		children: [/* @__PURE__ */ f("div", {
			role: "tablist",
			className: "via-tabs__list",
			children: e.map((e, t) => {
				let n = e.id === d;
				return /* @__PURE__ */ p("button", {
					id: `${o}-tab-${e.id}`,
					role: "tab",
					type: "button",
					"aria-selected": n,
					"aria-controls": `${o}-panel-${e.id}`,
					tabIndex: n ? 0 : -1,
					className: `via-tabs__tab ${n ? "is-active" : ""}`,
					onClick: () => m(e.id),
					onKeyDown: (e) => h(e, t),
					children: [/* @__PURE__ */ f("span", { children: e.label }), e.badge && /* @__PURE__ */ f("span", {
						className: "via-tabs__badge",
						children: e.badge
					})]
				}, e.id);
			})
		}), e.map((e) => /* @__PURE__ */ f("div", {
			id: `${o}-panel-${e.id}`,
			role: "tabpanel",
			"aria-labelledby": `${o}-tab-${e.id}`,
			hidden: e.id !== d,
			className: "via-tabs__panel",
			children: e.id === d && e.content
		}, e.id))]
	});
}
//#endregion
//#region src/lib/Switch/Switch.tsx
var te = n(function({ label: e, description: t, size: n = "md", className: r = "", id: i, disabled: a, ...o }, c) {
	let l = s(), u = i ?? `via-switch-${l}`;
	return /* @__PURE__ */ p("label", {
		htmlFor: u,
		className: `via-switch via-switch--${n} ${a ? "is-disabled" : ""} ${r}`,
		children: [
			/* @__PURE__ */ f("input", {
				ref: c,
				id: u,
				type: "checkbox",
				role: "switch",
				className: "via-switch__input",
				disabled: a,
				...o
			}),
			/* @__PURE__ */ f("span", {
				className: "via-switch__track",
				"aria-hidden": "true",
				children: /* @__PURE__ */ f("span", { className: "via-switch__thumb" })
			}),
			(e || t) && /* @__PURE__ */ p("span", {
				className: "via-switch__copy",
				children: [e && /* @__PURE__ */ f("span", {
					className: "via-switch__label",
					children: e
				}), t && /* @__PURE__ */ f("span", {
					className: "via-switch__desc",
					children: t
				})]
			})
		]
	});
}), ne = n(function({ label: e, description: t, indeterminate: n, className: r = "", id: i, disabled: a, ...c }, u) {
	let d = s(), m = i ?? `via-checkbox-${d}`, h = l(null);
	return o(() => {
		h.current && (h.current.indeterminate = !!n);
	}, [n]), /* @__PURE__ */ p("label", {
		htmlFor: m,
		className: `via-checkbox ${a ? "is-disabled" : ""} ${r}`,
		children: [
			/* @__PURE__ */ f("input", {
				ref: (e) => {
					h.current = e, typeof u == "function" ? u(e) : u && (u.current = e);
				},
				id: m,
				type: "checkbox",
				className: "via-checkbox__input",
				disabled: a,
				...c
			}),
			/* @__PURE__ */ f("span", {
				className: "via-checkbox__box",
				"aria-hidden": "true",
				children: f(n ? E : _, {
					className: "via-checkbox__icon",
					size: 11,
					strokeWidth: 3
				})
			}),
			(e || t) && /* @__PURE__ */ p("span", {
				className: "via-checkbox__copy",
				children: [e && /* @__PURE__ */ f("span", {
					className: "via-checkbox__label",
					children: e
				}), t && /* @__PURE__ */ f("span", {
					className: "via-checkbox__desc",
					children: t
				})]
			})
		]
	});
});
//#endregion
//#region src/lib/RadioGroup/RadioGroup.tsx
function re({ options: e, value: t, defaultValue: n, onValueChange: r, name: i, ariaLabel: a, className: o = "" }) {
	let c = s(), l = i ?? `via-radio-${c}`;
	return /* @__PURE__ */ f("div", {
		role: "radiogroup",
		"aria-label": a,
		className: `via-radio-group ${o}`,
		children: e.map((e) => {
			let i = `${l}-${e.value}`, a = t === void 0 ? n === e.value : t === e.value, o = t === void 0 ? {
				defaultChecked: a,
				onChange: () => r?.(e.value)
			} : {
				checked: a,
				onChange: () => r?.(e.value)
			};
			return /* @__PURE__ */ p("label", {
				htmlFor: i,
				className: `via-radio ${e.disabled ? "is-disabled" : ""}`,
				children: [
					/* @__PURE__ */ f("input", {
						id: i,
						type: "radio",
						name: l,
						value: e.value,
						disabled: e.disabled,
						className: "via-radio__input",
						...o
					}),
					/* @__PURE__ */ f("span", {
						className: "via-radio__circle",
						"aria-hidden": "true",
						children: /* @__PURE__ */ f("span", { className: "via-radio__dot" })
					}),
					/* @__PURE__ */ p("span", {
						className: "via-radio__copy",
						children: [/* @__PURE__ */ f("span", {
							className: "via-radio__label",
							children: e.label
						}), e.description && /* @__PURE__ */ f("span", {
							className: "via-radio__desc",
							children: e.description
						})]
					})
				]
			}, e.value);
		})
	});
}
//#endregion
//#region src/lib/Select/Select.tsx
function ie({ options: e, value: t, defaultValue: n, onValueChange: r, placeholder: i = "Selecione…", disabled: a, error: c, label: d, hint: m, ariaLabel: h, className: g = "", size: y = "md" }) {
	let b = s(), x = `via-select-list-${b}`, S = `via-select-label-${b}`, [C, w] = u(!1), [T, E] = u(n), D = t ?? T, O = l(null), k = l(null), A = l(null), [j, M] = u(-1), N = e.find((e) => e.value === D), P = (e) => {
		t === void 0 && E(e), r?.(e), w(!1), k.current?.focus();
	}, F = (t) => {
		let n = t === 1 ? 0 : e.length - 1;
		for (let r = n; r >= 0 && r < e.length; r += t) if (!e[r]?.disabled) return r;
		return -1;
	}, I = () => {
		let t = e.findIndex((e) => e.value === D && !e.disabled);
		M(t >= 0 ? t : F(1)), w(!0);
	}, L = (t) => {
		e.length && M((n) => {
			let r = n < 0 ? t === 1 ? -1 : 0 : n;
			for (let n = 0; n < e.length; n++) if (r = (r + t + e.length) % e.length, !e[r]?.disabled) return r;
			return n;
		});
	};
	return o(() => {
		!C || j < 0 || !A.current || A.current.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
	}, [j, C]), o(() => {
		if (!C) return;
		let e = (e) => {
			O.current && !O.current.contains(e.target) && w(!1);
		};
		return document.addEventListener("mousedown", e), () => document.removeEventListener("mousedown", e);
	}, [C]), o(() => {
		if (!C) return;
		let e = (e) => {
			e.key === "Escape" && (w(!1), k.current?.focus());
		};
		return document.addEventListener("keydown", e), () => document.removeEventListener("keydown", e);
	}, [C]), /* @__PURE__ */ p("div", {
		ref: O,
		className: `via-select via-select--${y} ${g}`,
		children: [
			d && /* @__PURE__ */ f("label", {
				id: S,
				className: "via-select__label",
				children: d
			}),
			/* @__PURE__ */ p("button", {
				ref: k,
				type: "button",
				className: `via-select__trigger ${C ? "is-open" : ""} ${c ? "has-error" : ""}`,
				"aria-haspopup": "listbox",
				"aria-expanded": C,
				"aria-labelledby": d ? S : void 0,
				"aria-label": d ? void 0 : h,
				"aria-controls": x,
				"aria-activedescendant": C && j >= 0 ? `${x}-opt-${j}` : void 0,
				disabled: a,
				onClick: () => C ? w(!1) : I(),
				onKeyDown: (t) => {
					if (!a) switch (t.key) {
						case "ArrowDown":
							t.preventDefault(), C ? L(1) : I();
							break;
						case "ArrowUp":
							t.preventDefault(), C ? L(-1) : I();
							break;
						case "Home":
							C && (t.preventDefault(), M(F(1)));
							break;
						case "End":
							C && (t.preventDefault(), M(F(-1)));
							break;
						case "Enter":
						case " ":
							t.preventDefault(), C ? j >= 0 && e[j] && !e[j].disabled && P(e[j].value) : I();
							break;
						default: break;
					}
				},
				children: [/* @__PURE__ */ f("span", {
					className: `via-select__value ${N ? "" : "is-placeholder"}`,
					children: N ? N.label : i
				}), /* @__PURE__ */ f(v, {
					className: "via-select__chevron",
					size: 14,
					strokeWidth: 2,
					"aria-hidden": "true"
				})]
			}),
			(m || c) && /* @__PURE__ */ f("span", {
				className: `via-select__hint ${c ? "is-error" : ""}`,
				children: c || m
			}),
			C && /* @__PURE__ */ f("ul", {
				id: x,
				ref: A,
				role: "listbox",
				className: "via-select__list",
				children: e.map((e, t) => {
					let n = e.value === D;
					return /* @__PURE__ */ p("li", {
						id: `${x}-opt-${t}`,
						role: "option",
						"aria-selected": n,
						"aria-disabled": e.disabled,
						tabIndex: -1,
						className: `via-select__option ${n ? "is-selected" : ""} ${t === j ? "is-active" : ""} ${e.disabled ? "is-disabled" : ""}`,
						onMouseEnter: () => !e.disabled && M(t),
						onClick: () => !e.disabled && P(e.value),
						children: [/* @__PURE__ */ f("span", { children: e.label }), n && /* @__PURE__ */ f(_, {
							className: "via-select__check",
							size: 12,
							strokeWidth: 2.4,
							"aria-hidden": "true"
						})]
					}, e.value);
				})
			})
		]
	});
}
//#endregion
//#region src/lib/Progress/Progress.tsx
function ae({ value: e, label: t, showValue: n, tone: r = "navy", size: i = "md", ariaLabel: a, className: o = "" }) {
	let s = Math.max(0, Math.min(100, e));
	return /* @__PURE__ */ p("div", {
		className: `via-progress via-progress--${i} via-progress--${r} ${o}`,
		children: [(t || n) && /* @__PURE__ */ p("div", {
			className: "via-progress__head",
			children: [t && /* @__PURE__ */ f("span", {
				className: "via-progress__label",
				children: t
			}), n && /* @__PURE__ */ p("span", {
				className: "via-progress__value",
				"aria-hidden": "true",
				children: [Math.round(s), "%"]
			})]
		}), /* @__PURE__ */ f("div", {
			className: "via-progress__track",
			role: "progressbar",
			"aria-valuenow": s,
			"aria-valuemin": 0,
			"aria-valuemax": 100,
			"aria-label": a || (typeof t == "string" ? t : void 0),
			children: /* @__PURE__ */ f("div", {
				className: "via-progress__fill",
				style: { width: `${s}%` }
			})
		})]
	});
}
//#endregion
//#region src/lib/Drawer/Drawer.tsx
var oe = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";
function se({ open: e, onClose: t, side: n = "right", size: r = "md", title: i, description: a, children: c, footer: u, hideClose: d = !1 }) {
	let m = l(null), h = s(), g = l(null);
	return o(() => {
		if (!e) return;
		let n = (e) => e.key === "Escape" && t();
		document.addEventListener("keydown", n);
		let r = document.body.style.overflow;
		return document.body.style.overflow = "hidden", () => {
			document.removeEventListener("keydown", n), document.body.style.overflow = r;
		};
	}, [e, t]), o(() => {
		if (e) return g.current = document.activeElement, () => {
			g.current?.focus?.();
		};
	}, [e]), o(() => {
		!e || !m.current || m.current.querySelector(oe)?.focus();
	}, [e]), e ? /* @__PURE__ */ p("div", {
		className: "via-drawer-root",
		role: "presentation",
		children: [/* @__PURE__ */ f("div", {
			className: "via-drawer-scrim",
			onClick: t,
			"aria-hidden": "true"
		}), /* @__PURE__ */ p("div", {
			ref: m,
			className: `via-drawer via-drawer--${n} via-drawer--${r}`,
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": i ? h : void 0,
			tabIndex: -1,
			onKeyDown: (e) => {
				if (e.key !== "Tab" || !m.current) return;
				let t = Array.from(m.current.querySelectorAll(oe));
				if (t.length === 0) {
					e.preventDefault(), m.current.focus();
					return;
				}
				let n = t[0], r = t[t.length - 1], i = document.activeElement;
				e.shiftKey ? (i === n || !m.current.contains(i)) && (e.preventDefault(), r.focus()) : (i === r || !m.current.contains(i)) && (e.preventDefault(), n.focus());
			},
			children: [
				(i || !d) && /* @__PURE__ */ p("header", {
					className: "via-drawer__head",
					children: [/* @__PURE__ */ p("div", { children: [i && /* @__PURE__ */ f("h2", {
						id: h,
						children: i
					}), a && /* @__PURE__ */ f("p", { children: a })] }), !d && /* @__PURE__ */ f("button", {
						type: "button",
						className: "via-drawer__close",
						onClick: t,
						"aria-label": "Fechar drawer",
						children: /* @__PURE__ */ f(k, {
							size: 14,
							strokeWidth: 2.2
						})
					})]
				}),
				/* @__PURE__ */ f("div", {
					className: "via-drawer__body",
					children: c
				}),
				u && /* @__PURE__ */ f("footer", {
					className: "via-drawer__foot",
					children: u
				})
			]
		})]
	}) : null;
}
//#endregion
//#region src/lib/Spinner/Spinner.tsx
function ce({ size: e = "md", tone: t = "navy", label: n, className: r = "" }) {
	return /* @__PURE__ */ p("span", {
		className: `via-spinner via-spinner--${e} via-spinner--${t} ${r}`,
		role: "status",
		"aria-live": "polite",
		children: [
			/* @__PURE__ */ p("svg", {
				className: "via-spinner__svg",
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ f("circle", {
					className: "via-spinner__track",
					cx: "12",
					cy: "12",
					r: "10"
				}), /* @__PURE__ */ f("circle", {
					className: "via-spinner__head",
					cx: "12",
					cy: "12",
					r: "10"
				})]
			}),
			n && /* @__PURE__ */ f("span", {
				className: "via-spinner__label",
				children: n
			}),
			!n && /* @__PURE__ */ f("span", {
				className: "via-spinner__sr",
				children: "Carregando…"
			})
		]
	});
}
//#endregion
//#region src/lib/Skeleton/Skeleton.tsx
function le({ variant: e = "text", width: t, height: n, lines: r = 1, ariaLabel: i = "Carregando", className: a = "", style: o }) {
	return e === "text" && r > 1 ? /* @__PURE__ */ f("span", {
		className: `via-skeleton-group ${a}`,
		role: "status",
		"aria-label": i,
		"aria-busy": "true",
		children: Array.from({ length: r }).map((e, t) => /* @__PURE__ */ f("span", {
			className: "via-skeleton via-skeleton--text",
			style: { width: t === r - 1 ? "70%" : "100%" }
		}, t))
	}) : /* @__PURE__ */ f("span", {
		className: `via-skeleton via-skeleton--${e} ${a}`,
		role: "status",
		"aria-label": i,
		"aria-busy": "true",
		style: {
			width: t === void 0 ? void 0 : typeof t == "number" ? `${t}px` : t,
			height: n === void 0 ? void 0 : typeof n == "number" ? `${n}px` : n,
			...o
		}
	});
}
//#endregion
//#region src/lib/Breadcrumb/Breadcrumb.tsx
function ue({ items: e, separator: t, ariaLabel: n = "Caminho de navegação", className: r = "" }) {
	return /* @__PURE__ */ f("nav", {
		"aria-label": n,
		className: `via-breadcrumb ${r}`,
		children: /* @__PURE__ */ f("ol", {
			className: "via-breadcrumb__list",
			children: e.map((n, r) => {
				let i = r === e.length - 1, a = t ?? /* @__PURE__ */ f(b, {
					size: 12,
					strokeWidth: 2,
					"aria-hidden": "true"
				});
				return /* @__PURE__ */ p("li", {
					className: "via-breadcrumb__item",
					children: [n.href && !i ? /* @__PURE__ */ f("a", {
						href: n.href,
						className: "via-breadcrumb__link",
						onClick: n.onClick,
						children: n.label
					}) : n.onClick && !i ? /* @__PURE__ */ f("button", {
						type: "button",
						className: "via-breadcrumb__link via-breadcrumb__link--btn",
						onClick: n.onClick,
						children: n.label
					}) : /* @__PURE__ */ f("span", {
						className: "via-breadcrumb__current",
						"aria-current": i ? "page" : void 0,
						children: n.label
					}), !i && /* @__PURE__ */ f("span", {
						className: "via-breadcrumb__sep",
						"aria-hidden": "true",
						children: a
					})]
				}, r);
			})
		})
	});
}
//#endregion
//#region src/lib/Pagination/Pagination.tsx
function de({ page: e, totalPages: t, onPageChange: n, ariaLabel: r = "Paginação", className: i = "", maxVisible: a = 7 }) {
	if (t <= 1) return null;
	let o = fe(e, t, a), s = e > 1, c = e < t;
	return /* @__PURE__ */ p("nav", {
		"aria-label": r,
		className: `via-pagination ${i}`,
		children: [
			/* @__PURE__ */ p("button", {
				type: "button",
				className: "via-pagination__nav",
				disabled: !s,
				onClick: () => s && n(e - 1),
				"aria-label": "Página anterior",
				children: [/* @__PURE__ */ f(y, {
					size: 14,
					strokeWidth: 2
				}), /* @__PURE__ */ f("span", { children: "Anterior" })]
			}),
			/* @__PURE__ */ f("ul", {
				className: "via-pagination__list",
				role: "list",
				children: o.map((t, r) => t === "…" ? /* @__PURE__ */ f("li", {
					className: "via-pagination__gap",
					"aria-hidden": "true",
					children: "…"
				}, `gap-${r}`) : /* @__PURE__ */ f("li", { children: /* @__PURE__ */ f("button", {
					type: "button",
					className: `via-pagination__page ${t === e ? "is-active" : ""}`,
					"aria-current": t === e ? "page" : void 0,
					"aria-label": `Página ${t}`,
					onClick: () => n(t),
					children: t
				}) }, t))
			}),
			/* @__PURE__ */ p("button", {
				type: "button",
				className: "via-pagination__nav",
				disabled: !c,
				onClick: () => c && n(e + 1),
				"aria-label": "Próxima página",
				children: [/* @__PURE__ */ f("span", { children: "Próxima" }), /* @__PURE__ */ f(b, {
					size: 14,
					strokeWidth: 2
				})]
			})
		]
	});
}
function fe(e, t, n) {
	if (t <= n) return Array.from({ length: t }, (e, t) => t + 1);
	let r = Math.floor((n - 3) / 2), i = Math.max(2, e - r), a = Math.min(t - 1, e + r), o = [1];
	i > 2 && o.push("…");
	for (let e = i; e <= a; e++) o.push(e);
	return a < t - 1 && o.push("…"), o.push(t), o;
}
//#endregion
//#region src/lib/Accordion/Accordion.tsx
function pe({ items: e, defaultOpen: t, multiple: n = !1, variant: r = "default", className: i = "" }) {
	let a = s(), [o, c] = u(Array.isArray(t) ? new Set(t) : t ? new Set([t]) : /* @__PURE__ */ new Set()), l = (e) => {
		c((t) => {
			let r = new Set(t);
			return r.has(e) ? r.delete(e) : (n || r.clear(), r.add(e)), r;
		});
	};
	return /* @__PURE__ */ f("div", {
		className: `via-accordion via-accordion--${r} ${i}`,
		children: e.map((e) => {
			let t = o.has(e.id), n = `${a}-trigger-${e.id}`, r = `${a}-panel-${e.id}`;
			return /* @__PURE__ */ p("div", {
				className: `via-accordion__item ${t ? "is-open" : ""} ${e.disabled ? "is-disabled" : ""}`,
				children: [/* @__PURE__ */ f("h3", {
					className: "via-accordion__heading",
					children: /* @__PURE__ */ p("button", {
						type: "button",
						id: n,
						className: "via-accordion__trigger",
						"aria-expanded": t,
						"aria-controls": r,
						disabled: e.disabled,
						onClick: () => !e.disabled && l(e.id),
						children: [/* @__PURE__ */ f("span", {
							className: "via-accordion__title",
							children: e.title
						}), /* @__PURE__ */ f(v, {
							className: "via-accordion__chevron",
							size: 14,
							strokeWidth: 2,
							"aria-hidden": "true"
						})]
					})
				}), /* @__PURE__ */ f("div", {
					id: r,
					role: "region",
					"aria-labelledby": n,
					className: "via-accordion__panel",
					hidden: !t,
					children: /* @__PURE__ */ f("div", {
						className: "via-accordion__content",
						children: e.content
					})
				})]
			}, e.id);
		})
	});
}
//#endregion
//#region src/lib/Stepper/Stepper.tsx
function me({ steps: e, current: t, orientation: n = "horizontal", onStepClick: r, ariaLabel: i = "Progresso", className: a = "" }) {
	return /* @__PURE__ */ f("nav", {
		"aria-label": i,
		className: `via-stepper via-stepper--${n} ${a}`,
		children: /* @__PURE__ */ f("ol", {
			className: "via-stepper__list",
			children: e.map((n, i) => {
				let a = i < t, o = i === t, s = a ? "complete" : o ? "current" : "future", c = r && a;
				return /* @__PURE__ */ p("li", {
					className: `via-stepper__item is-${s}`,
					"aria-current": o ? "step" : void 0,
					children: [c ? /* @__PURE__ */ p("button", {
						type: "button",
						className: "via-stepper__node",
						onClick: () => r(i),
						"aria-label": `Voltar para ${typeof n.label == "string" ? n.label : `passo ${i + 1}`}`,
						children: [/* @__PURE__ */ f(he, {
							index: i,
							status: s
						}), /* @__PURE__ */ p("span", {
							className: "via-stepper__copy",
							children: [/* @__PURE__ */ f("span", {
								className: "via-stepper__label",
								children: n.label
							}), n.description && /* @__PURE__ */ f("span", {
								className: "via-stepper__desc",
								children: n.description
							})]
						})]
					}) : /* @__PURE__ */ p("div", {
						className: "via-stepper__node",
						children: [/* @__PURE__ */ f(he, {
							index: i,
							status: s
						}), /* @__PURE__ */ p("span", {
							className: "via-stepper__copy",
							children: [/* @__PURE__ */ f("span", {
								className: "via-stepper__label",
								children: n.label
							}), n.description && /* @__PURE__ */ f("span", {
								className: "via-stepper__desc",
								children: n.description
							})]
						})]
					}), i < e.length - 1 && /* @__PURE__ */ f("span", {
						className: `via-stepper__connector ${a ? "is-complete" : ""}`,
						"aria-hidden": "true"
					})]
				}, n.id);
			})
		})
	});
}
function he({ index: e, status: t }) {
	return /* @__PURE__ */ f("span", {
		className: `via-stepper__indicator is-${t}`,
		children: t === "complete" ? /* @__PURE__ */ f(_, {
			size: 12,
			strokeWidth: 2.6,
			"aria-hidden": "true"
		}) : /* @__PURE__ */ f("span", { children: e + 1 })
	});
}
//#endregion
//#region src/lib/EmptyState/EmptyState.tsx
function ge({ icon: e, title: t, description: n, action: r, secondary: i, variant: a = "default", className: o = "" }) {
	return /* @__PURE__ */ p("div", {
		className: `via-empty-state via-empty-state--${a} ${o}`,
		role: "status",
		children: [
			e && /* @__PURE__ */ f("div", {
				className: "via-empty-state__icon",
				"aria-hidden": "true",
				children: e
			}),
			/* @__PURE__ */ f("h3", {
				className: "via-empty-state__title",
				children: t
			}),
			n && /* @__PURE__ */ f("p", {
				className: "via-empty-state__description",
				children: n
			}),
			(r || i) && /* @__PURE__ */ p("div", {
				className: "via-empty-state__actions",
				children: [r, i]
			})
		]
	});
}
//#endregion
//#region src/lib/Combobox/Combobox.tsx
function _e({ options: e, value: t, defaultValue: n, onValueChange: r, placeholder: i = "Buscar…", emptyLabel: a = "Nenhum resultado", label: c, ariaLabel: d, className: m = "", size: h = "md", disabled: g }) {
	let y = s(), b = `via-combobox-list-${y}`, x = `via-combobox-label-${y}`, [S, C] = u(!1), [w, T] = u(""), [E, D] = u(n), k = t ?? E, A = l(null), j = l(null), M = l(null), [N, P] = u(-1), F = e.find((e) => e.value === k), I = w.trim() ? e.filter((e) => (e.searchText ?? (typeof e.label == "string" ? e.label : e.value)).toLowerCase().includes(w.trim().toLowerCase())) : e, L = (e) => {
		t === void 0 && D(e), r?.(e), C(!1), T("");
	}, R = (e) => {
		I.length && P((t) => {
			let n = t;
			for (let t = 0; t < I.length; t++) if (n = (n + e + I.length) % I.length, !I[n]?.disabled) return n;
			return t;
		});
	};
	return o(() => {
		N < 0 || !M.current || M.current.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
	}, [N]), o(() => {
		if (!S) return;
		let e = (e) => {
			A.current && !A.current.contains(e.target) && (C(!1), T(""));
		};
		return document.addEventListener("mousedown", e), () => document.removeEventListener("mousedown", e);
	}, [S]), o(() => {
		if (!S) return;
		let e = (e) => {
			e.key === "Escape" && (C(!1), T(""), j.current?.blur());
		};
		return document.addEventListener("keydown", e), () => document.removeEventListener("keydown", e);
	}, [S]), /* @__PURE__ */ p("div", {
		ref: A,
		className: `via-combobox via-combobox--${h} ${m}`,
		children: [
			c && /* @__PURE__ */ f("label", {
				id: x,
				className: "via-combobox__label",
				htmlFor: `${y}-input`,
				children: c
			}),
			/* @__PURE__ */ p("div", {
				className: `via-combobox__trigger ${S ? "is-open" : ""} ${g ? "is-disabled" : ""}`,
				children: [
					/* @__PURE__ */ f(O, {
						size: 13,
						strokeWidth: 2.2,
						className: "via-combobox__icon",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ f("input", {
						ref: j,
						id: `${y}-input`,
						type: "text",
						className: "via-combobox__input",
						role: "combobox",
						"aria-haspopup": "listbox",
						"aria-expanded": S,
						"aria-controls": b,
						"aria-label": c ? void 0 : d,
						"aria-labelledby": c ? x : void 0,
						placeholder: F && typeof F.label == "string" ? F.label : i,
						value: S ? w : F && typeof F.label == "string" ? F.label : "",
						onChange: (e) => {
							T(e.target.value), P(0), S || C(!0);
						},
						onKeyDown: (e) => {
							e.key === "ArrowDown" ? (e.preventDefault(), S ? R(1) : (C(!0), P(0))) : e.key === "ArrowUp" ? (e.preventDefault(), R(-1)) : e.key === "Enter" && S && N >= 0 && I[N] && !I[N].disabled && (e.preventDefault(), L(I[N].value));
						},
						onFocus: () => {
							g || (C(!0), P(0));
						},
						"aria-activedescendant": S && N >= 0 ? `${b}-opt-${N}` : void 0,
						disabled: g
					}),
					/* @__PURE__ */ f(v, {
						className: "via-combobox__chevron",
						size: 13,
						strokeWidth: 2.2,
						"aria-hidden": "true"
					})
				]
			}),
			S && /* @__PURE__ */ f("ul", {
				id: b,
				ref: M,
				role: "listbox",
				className: "via-combobox__list",
				children: I.length === 0 ? /* @__PURE__ */ f("li", {
					className: "via-combobox__empty",
					children: a
				}) : I.map((e, t) => {
					let n = e.value === k;
					return /* @__PURE__ */ p("li", {
						id: `${b}-opt-${t}`,
						role: "option",
						"aria-selected": n,
						className: `via-combobox__option ${n ? "is-selected" : ""} ${t === N ? "is-active" : ""} ${e.disabled ? "is-disabled" : ""}`,
						"aria-disabled": e.disabled,
						onMouseEnter: () => !e.disabled && P(t),
						onClick: () => !e.disabled && L(e.value),
						children: [/* @__PURE__ */ f("span", { children: e.label }), n && /* @__PURE__ */ f(_, {
							size: 12,
							strokeWidth: 2.4,
							"aria-hidden": "true",
							className: "via-combobox__check"
						})]
					}, e.value);
				})
			})
		]
	});
}
//#endregion
//#region src/lib/DropdownMenu/DropdownMenu.tsx
function ve({ trigger: e, items: t, groups: n, align: r = "start", ariaLabel: i = "Menu", className: a = "" }) {
	let c = `via-dropdown-${s()}`, [d, m] = u(!1), [h, g] = u(0), _ = l(null), v = l(null), y = l([]), b = n || (t ? [{
		id: "main",
		items: t
	}] : []), x = b.flatMap((e) => e.items), S = () => x.findIndex((e) => !e.disabled), C = () => {
		for (let e = x.length - 1; e >= 0; e--) if (!x[e].disabled) return e;
		return -1;
	}, w = () => v.current?.querySelector("button, [tabindex]")?.focus(), T = () => {
		m((e) => {
			if (!e) {
				let e = S();
				g(e === -1 ? 0 : e);
			}
			return !e;
		});
	}, E = (e) => {
		e.disabled || (e.onSelect?.(), m(!1), w());
	};
	o(() => {
		d && y.current[h]?.focus();
	}, [d]);
	let D = (e) => {
		g(e), y.current[e]?.focus();
	}, O = (e) => {
		let { key: t } = e;
		if (t !== "ArrowDown" && t !== "ArrowUp" && t !== "Home" && t !== "End") return;
		e.preventDefault();
		let n = x.length;
		if (n === 0) return;
		let r = (e, t) => {
			let r = e;
			for (let e = 0; e < n; e++) if (r = (r + t + n) % n, !x[r].disabled) return r;
			return e;
		};
		if (t === "ArrowDown") D(r(h, 1));
		else if (t === "ArrowUp") D(r(h, -1));
		else if (t === "Home") {
			let e = S();
			e !== -1 && D(e);
		} else if (t === "End") {
			let e = C();
			e !== -1 && D(e);
		}
	};
	o(() => {
		if (!d) return;
		let e = (e) => {
			_.current && !_.current.contains(e.target) && m(!1);
		};
		return document.addEventListener("mousedown", e), () => document.removeEventListener("mousedown", e);
	}, [d]), o(() => {
		if (!d) return;
		let e = (e) => {
			e.key === "Escape" && (m(!1), w());
		};
		return document.addEventListener("keydown", e), () => document.removeEventListener("keydown", e);
	}, [d]);
	let k = (e, t) => {
		let n = 0;
		for (let t = 0; t < e; t++) n += b[t].items.length;
		return n + t;
	};
	return /* @__PURE__ */ p("div", {
		ref: _,
		className: `via-dropdown ${a}`,
		children: [/* @__PURE__ */ f("div", {
			ref: v,
			className: "via-dropdown__trigger-wrap",
			onClick: T,
			children: e
		}), d && /* @__PURE__ */ f("div", {
			id: c,
			role: "menu",
			"aria-label": i,
			className: `via-dropdown__menu via-dropdown__menu--${r}`,
			onKeyDown: O,
			children: b.map((e, t) => /* @__PURE__ */ p("div", {
				className: "via-dropdown__group",
				role: "group",
				"aria-label": typeof e.label == "string" ? e.label : void 0,
				children: [
					e.label && /* @__PURE__ */ f("div", {
						className: "via-dropdown__group-label",
						"aria-hidden": "true",
						children: e.label
					}),
					e.items.map((e, n) => {
						let r = k(t, n);
						return /* @__PURE__ */ p("button", {
							ref: (e) => {
								y.current[r] = e;
							},
							type: "button",
							role: "menuitem",
							tabIndex: r === h ? 0 : -1,
							className: `via-dropdown__item ${e.destructive ? "is-destructive" : ""} ${e.disabled ? "is-disabled" : ""}`,
							disabled: e.disabled,
							onClick: () => E(e),
							children: [
								e.icon && /* @__PURE__ */ f("span", {
									className: "via-dropdown__icon",
									"aria-hidden": "true",
									children: e.icon
								}),
								/* @__PURE__ */ f("span", {
									className: "via-dropdown__label",
									children: e.label
								}),
								e.shortcut && /* @__PURE__ */ f("kbd", {
									className: "via-dropdown__shortcut",
									"aria-hidden": "true",
									children: e.shortcut
								})
							]
						}, e.id);
					}),
					t < b.length - 1 && /* @__PURE__ */ f("div", {
						className: "via-dropdown__separator",
						role: "separator",
						"aria-hidden": "true"
					})
				]
			}, e.id))
		})]
	});
}
//#endregion
//#region src/lib/Popover/Popover.tsx
function ye({ open: e, onOpenChange: t, trigger: n, children: r, side: i = "bottom", align: a = "center", closeOnOutsideClick: c = !0, closeOnEscape: u = !0, label: d }) {
	let m = l(null), h = l(null), g = s(), _ = () => {
		let e = h.current;
		return e ? e.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])") ?? e : null;
	};
	return o(() => {
		let t = _();
		t && (t.setAttribute("aria-haspopup", "dialog"), t.setAttribute("aria-expanded", e ? "true" : "false"), t.setAttribute("aria-controls", g), t === h.current && !t.hasAttribute("tabindex") && (t.tabIndex = 0));
	}, [
		e,
		g,
		n
	]), o(() => {
		if (!e || !c) return;
		let n = (e) => {
			m.current && (m.current.contains(e.target) || t(!1));
		};
		return document.addEventListener("mousedown", n), () => document.removeEventListener("mousedown", n);
	}, [
		e,
		c,
		t
	]), o(() => {
		if (!e || !u) return;
		let n = (e) => {
			e.key === "Escape" && (t(!1), _()?.focus());
		};
		return document.addEventListener("keydown", n), () => document.removeEventListener("keydown", n);
	}, [
		e,
		u,
		t
	]), /* @__PURE__ */ p("span", {
		ref: m,
		className: "via-popover-wrap",
		"data-side": i,
		"data-align": a,
		children: [/* @__PURE__ */ f("span", {
			ref: h,
			"data-popover-trigger": !0,
			children: n
		}), e && /* @__PURE__ */ p("div", {
			id: g,
			className: `via-popover via-popover--${i} via-popover--align-${a}`,
			role: "dialog",
			"aria-label": d,
			children: [/* @__PURE__ */ f("div", {
				className: "via-popover__arrow",
				"aria-hidden": "true"
			}), /* @__PURE__ */ f("div", {
				className: "via-popover__body",
				children: r
			})]
		})]
	});
}
//#endregion
//#region src/lib/Command/Command.tsx
function be({ open: e, onClose: t, onSelect: n, groups: r, items: i, placeholder: a = "Buscar comandos, páginas, ações…", emptyLabel: s = "Nada encontrado." }) {
	let d = l(null), [m, h] = u(""), [g, _] = u(0), v = c(() => r && r.length ? r : i && i.length ? [{ items: i }] : [], [r, i]), y = c(() => {
		let e = m.trim().toLowerCase();
		return e ? v.map((t) => ({
			...t,
			items: t.items.filter((t) => `${t.label} ${t.hint ?? ""} ${t.keywords ?? ""}`.toLowerCase().includes(e))
		})).filter((e) => e.items.length > 0) : v;
	}, [v, m]), b = c(() => y.flatMap((e) => e.items), [y]), [x, S] = u(e);
	if (e !== x && (S(e), e && (h(""), _(0))), o(() => {
		e && requestAnimationFrame(() => d.current?.focus());
	}, [e]), b.length > 0 && g > b.length - 1 && _(b.length - 1), o(() => {
		if (!e) return;
		let n = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		let r = (e) => {
			e.key === "Escape" && (e.preventDefault(), t());
		};
		return document.addEventListener("keydown", r), () => {
			document.removeEventListener("keydown", r), document.body.style.overflow = n;
		};
	}, [e, t]), !e) return null;
	let w = (e) => {
		if (e.key === "ArrowDown") e.preventDefault(), _((e) => Math.min(b.length - 1, e + 1));
		else if (e.key === "ArrowUp") e.preventDefault(), _((e) => Math.max(0, e - 1));
		else if (e.key === "Enter") {
			e.preventDefault();
			let r = b[g];
			r && (n(r.id), t());
		}
	}, T = -1;
	return /* @__PURE__ */ p("div", {
		className: "via-cmd-root",
		role: "presentation",
		children: [/* @__PURE__ */ f("div", {
			className: "via-cmd-scrim",
			onClick: t,
			"aria-hidden": "true"
		}), /* @__PURE__ */ p("div", {
			className: "via-cmd",
			role: "dialog",
			"aria-modal": "true",
			"aria-label": "Paleta de comandos",
			children: [
				/* @__PURE__ */ p("header", {
					className: "via-cmd__head",
					children: [
						/* @__PURE__ */ f(O, {
							size: 15,
							strokeWidth: 1.8,
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ f("input", {
							ref: d,
							type: "text",
							value: m,
							onChange: (e) => {
								h(e.target.value), _(0);
							},
							onKeyDown: w,
							placeholder: a,
							"aria-label": "Buscar",
							"aria-autocomplete": "list",
							"aria-controls": "via-cmd-list",
							"aria-activedescendant": b[g] ? `via-cmd-item-${b[g].id}` : void 0
						}),
						/* @__PURE__ */ f("button", {
							type: "button",
							onClick: t,
							"aria-label": "Fechar",
							className: "via-cmd__close",
							children: /* @__PURE__ */ f(k, {
								size: 13,
								strokeWidth: 2.2
							})
						})
					]
				}),
				/* @__PURE__ */ f("div", {
					className: "via-cmd__list",
					id: "via-cmd-list",
					role: "listbox",
					children: b.length === 0 ? /* @__PURE__ */ f("p", {
						className: "via-cmd__empty",
						children: s
					}) : y.map((e, r) => /* @__PURE__ */ p("div", {
						className: "via-cmd__group",
						children: [e.heading && /* @__PURE__ */ f("span", {
							className: "via-cmd__heading",
							children: e.heading
						}), /* @__PURE__ */ f("ul", { children: e.items.map((e) => {
							T += 1;
							let r = T === g, i = T;
							return /* @__PURE__ */ p("li", {
								id: `via-cmd-item-${e.id}`,
								role: "option",
								"aria-selected": r,
								className: r ? "on" : "",
								onMouseEnter: () => _(i),
								onClick: () => {
									n(e.id), t();
								},
								children: [
									e.icon && /* @__PURE__ */ f("span", {
										className: "via-cmd__icon",
										children: e.icon
									}),
									/* @__PURE__ */ p("div", {
										className: "via-cmd__label",
										children: [/* @__PURE__ */ f("strong", { children: e.label }), e.hint && /* @__PURE__ */ f("em", { children: e.hint })]
									}),
									e.shortcut && /* @__PURE__ */ f("kbd", {
										className: "via-cmd__kbd",
										children: e.shortcut
									})
								]
							}, e.id);
						}) })]
					}, r))
				}),
				/* @__PURE__ */ p("footer", {
					className: "via-cmd__foot",
					children: [
						/* @__PURE__ */ p("span", { children: [
							/* @__PURE__ */ f("kbd", { children: "↑" }),
							/* @__PURE__ */ f("kbd", { children: "↓" }),
							" navegar"
						] }),
						/* @__PURE__ */ p("span", { children: [/* @__PURE__ */ f("kbd", { children: /* @__PURE__ */ f(C, {
							size: 10,
							strokeWidth: 2.4
						}) }), " abrir"] }),
						/* @__PURE__ */ p("span", { children: [/* @__PURE__ */ f("kbd", { children: "esc" }), " fechar"] })
					]
				})
			]
		})]
	});
}
//#endregion
//#region src/lib/DatePicker/DatePicker.tsx
var xe = [
	"janeiro",
	"fevereiro",
	"março",
	"abril",
	"maio",
	"junho",
	"julho",
	"agosto",
	"setembro",
	"outubro",
	"novembro",
	"dezembro"
], Se = [
	"seg",
	"ter",
	"qua",
	"qui",
	"sex",
	"sáb",
	"dom"
], Ce = [
	"dom",
	"seg",
	"ter",
	"qua",
	"qui",
	"sex",
	"sáb"
], G = (e, t) => e.getFullYear() === t.getFullYear() && e.getMonth() === t.getMonth() && e.getDate() === t.getDate(), K = (e) => new Date(e.getFullYear(), e.getMonth(), 1), we = (e, t) => new Date(e.getFullYear(), e.getMonth() + t, 1), q = (e, t) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + t), Te = (e) => `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`, Ee = (e) => `${String(e.getDate()).padStart(2, "0")}/${String(e.getMonth() + 1).padStart(2, "0")}/${e.getFullYear()}`;
function De({ value: e, onChange: t, min: n, max: r, placeholder: i = "Selecione uma data", label: a, ariaLabel: d, disabled: m = !1, weekStartsOn: h = 1, formatLabel: _ = Ee }) {
	let [v, x] = u(!1), [S, C] = u(() => K(e ?? /* @__PURE__ */ new Date())), [w, T] = u(() => e ?? /* @__PURE__ */ new Date()), E = l(null), D = l(null), O = s(), k = e ? e.getTime() : null, [A, j] = u(k);
	k !== A && (j(k), e && C(K(e))), o(() => {
		if (!v) return;
		let e = (e) => {
			E.current && !E.current.contains(e.target) && x(!1);
		}, t = (e) => e.key === "Escape" && x(!1);
		return document.addEventListener("mousedown", e), document.addEventListener("keydown", t), () => {
			document.removeEventListener("mousedown", e), document.removeEventListener("keydown", t);
		};
	}, [v]);
	let M = c(() => {
		let e = (K(S).getDay() - h + 7) % 7, t = new Date(S.getFullYear(), S.getMonth() + 1, 0).getDate(), n = [];
		for (let t = e - 1; t >= 0; t--) {
			let e = new Date(S.getFullYear(), S.getMonth(), -t);
			n.push({
				date: e,
				outside: !0
			});
		}
		for (let e = 1; e <= t; e++) n.push({
			date: new Date(S.getFullYear(), S.getMonth(), e),
			outside: !1
		});
		for (; n.length < 42;) {
			let e = n[n.length - 1].date;
			n.push({
				date: new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1),
				outside: !0
			});
		}
		return n;
	}, [S, h]), N = (e) => !!(n && e < new Date(n.getFullYear(), n.getMonth(), n.getDate()) || r && e > new Date(r.getFullYear(), r.getMonth(), r.getDate())), P = /* @__PURE__ */ new Date(), F = h === 1 ? Se : Ce, I = c(() => {
		let e = new Date(S.getFullYear(), S.getMonth() + 1, 0).getDate();
		for (let t = 1; t <= e; t++) {
			let e = new Date(S.getFullYear(), S.getMonth(), t);
			if (!N(e)) return e;
		}
		return K(S);
	}, [
		S,
		n,
		r
	]), L = (e) => e.getFullYear() === S.getFullYear() && e.getMonth() === S.getMonth(), R;
	R = w && L(w) && !N(w) ? w : e && L(e) && !N(e) ? e : L(P) && !N(P) ? P : I;
	let z = R.getTime();
	o(() => {
		if (!v) return;
		let e = E.current;
		if (e && !e.contains(document.activeElement)) return;
		let t = `${O}-day-${Te(new Date(z))}`;
		D.current?.querySelector(`[id="${t}"]`)?.focus();
	}, [v, z]);
	let B = (e, t, n) => {
		let r = q(e, t), i = 0;
		for (; N(r) && i < 366;) r = q(r, n), i++;
		N(r) || (T(r), (r.getFullYear() !== S.getFullYear() || r.getMonth() !== S.getMonth()) && C(K(r)));
	}, V = (e) => {
		let n = e.key, r = R;
		if (n === "Enter" || n === " " || n === "Spacebar") {
			e.preventDefault(), N(r) || (t(r), x(!1));
			return;
		}
		if (n === "ArrowRight") {
			e.preventDefault(), B(r, 1, 1);
			return;
		}
		if (n === "ArrowLeft") {
			e.preventDefault(), B(r, -1, -1);
			return;
		}
		if (n === "ArrowDown") {
			e.preventDefault(), B(r, 7, 1);
			return;
		}
		if (n === "ArrowUp") {
			e.preventDefault(), B(r, -7, -1);
			return;
		}
		if (n === "Home") {
			e.preventDefault(), H(r, "start");
			return;
		}
		if (n === "End") {
			e.preventDefault(), H(r, "end");
			return;
		}
		if (n === "PageUp") {
			e.preventDefault(), W(U(r, -1));
			return;
		}
		if (n === "PageDown") {
			e.preventDefault(), W(U(r, 1));
			return;
		}
	}, H = (e, t) => {
		let n = (e.getDay() - h + 7) % 7, r = q(e, -n), i = q(e, 6 - n), a = new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate(), o = new Date(e.getFullYear(), e.getMonth(), 1), s = new Date(e.getFullYear(), e.getMonth(), a), c = t === "start" ? r < o ? o : r : i > s ? s : i, l = t === "start" ? 1 : -1, u = 0;
		for (; N(c) && c >= r && c <= i && c >= o && c <= s && u < 7;) c = q(c, l), u++;
		N(c) || T(c);
	}, U = (e, t) => {
		let n = new Date(e.getFullYear(), e.getMonth() + t, 1), r = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
		return new Date(n.getFullYear(), n.getMonth(), Math.min(e.getDate(), r));
	}, W = (e) => {
		let t = e, n = 0;
		for (; N(t) && n < 31;) t = q(t, 1), n++;
		if (N(t)) for (t = e, n = 0; N(t) && n < 31;) t = q(t, -1), n++;
		N(t) || (T(t), C(K(t)));
	};
	return /* @__PURE__ */ p("div", {
		ref: E,
		className: "via-dp",
		children: [
			a && /* @__PURE__ */ f("label", {
				className: "via-dp__label",
				children: a
			}),
			/* @__PURE__ */ p("button", {
				type: "button",
				className: `via-dp__input ${e ? "has-value" : ""}`,
				onClick: () => !m && x((e) => !e),
				disabled: m,
				"aria-label": d ?? a ?? "Selecionar data",
				"aria-expanded": v,
				"aria-haspopup": "dialog",
				children: [/* @__PURE__ */ f(g, {
					size: 14,
					strokeWidth: 1.8,
					"aria-hidden": "true"
				}), /* @__PURE__ */ f("span", { children: e ? _(e) : i })]
			}),
			v && /* @__PURE__ */ p("div", {
				className: "via-dp__pop",
				role: "dialog",
				"aria-label": "Calendário",
				children: [
					/* @__PURE__ */ p("header", {
						className: "via-dp__head",
						children: [
							/* @__PURE__ */ f("button", {
								type: "button",
								onClick: () => C((e) => we(e, -1)),
								"aria-label": "Mês anterior",
								className: "via-dp__nav",
								children: /* @__PURE__ */ f(y, {
									size: 14,
									strokeWidth: 2.2
								})
							}),
							/* @__PURE__ */ p("strong", { children: [
								xe[S.getMonth()],
								" ",
								/* @__PURE__ */ f("span", {
									className: "mono",
									children: S.getFullYear()
								})
							] }),
							/* @__PURE__ */ f("button", {
								type: "button",
								onClick: () => C((e) => we(e, 1)),
								"aria-label": "Mês seguinte",
								className: "via-dp__nav",
								children: /* @__PURE__ */ f(b, {
									size: 14,
									strokeWidth: 2.2
								})
							})
						]
					}),
					/* @__PURE__ */ f("div", {
						className: "via-dp__dow",
						role: "row",
						children: F.map((e) => /* @__PURE__ */ f("span", {
							role: "columnheader",
							children: e
						}, e))
					}),
					/* @__PURE__ */ f("div", {
						className: "via-dp__grid",
						role: "grid",
						ref: D,
						onKeyDown: V,
						children: M.map((n, r) => {
							let i = e && G(n.date, e), a = G(n.date, P), o = N(n.date), s = !n.outside && !o && G(n.date, R);
							return /* @__PURE__ */ f("button", {
								id: `${O}-day-${Te(n.date)}`,
								type: "button",
								role: "gridcell",
								"aria-selected": !!i,
								"aria-current": a ? "date" : void 0,
								disabled: o,
								tabIndex: s ? 0 : -1,
								className: [
									"via-dp__cell",
									n.outside && "outside",
									i && "sel",
									a && "today"
								].filter(Boolean).join(" "),
								onClick: () => {
									t(n.date), x(!1);
								},
								children: n.date.getDate()
							}, r);
						})
					}),
					/* @__PURE__ */ p("footer", {
						className: "via-dp__foot",
						children: [/* @__PURE__ */ f("button", {
							type: "button",
							className: "via-dp__ghost",
							onClick: () => {
								t(null), x(!1);
							},
							children: "Limpar"
						}), /* @__PURE__ */ f("button", {
							type: "button",
							className: "via-dp__ghost",
							onClick: () => {
								t(P), C(K(P)), x(!1);
							},
							children: "Hoje"
						})]
					})
				]
			})
		]
	});
}
//#endregion
//#region src/lib/Slider/Slider.tsx
function Oe({ value: e, onChange: t, min: n = 0, max: r = 100, step: i = 1, label: a, hint: o, showValue: c = !0, formatValue: l = (e) => String(e), tone: u = "navy", size: d = "md", disabled: m = !1, ariaLabel: h, marks: g, name: _, id: v }) {
	let y = s(), b = v ?? `via-sl-${y}`, x = Math.max(0, Math.min(100, (e - n) / (r - n) * 100));
	return /* @__PURE__ */ p("div", {
		className: `via-slider via-slider--${u} via-slider--${d} ${m ? "is-disabled" : ""}`,
		children: [
			a && /* @__PURE__ */ p("header", {
				className: "via-slider__head",
				children: [/* @__PURE__ */ f("label", {
					htmlFor: b,
					children: a
				}), c && /* @__PURE__ */ f("strong", {
					className: "via-slider__val mono",
					children: l(e)
				})]
			}),
			/* @__PURE__ */ p("div", {
				className: "via-slider__track-wrap",
				style: { "--via-sl-pct": `${x}%` },
				children: [
					/* @__PURE__ */ f("div", {
						className: "via-slider__track",
						"aria-hidden": "true",
						children: /* @__PURE__ */ f("div", { className: "via-slider__fill" })
					}),
					g && g.length > 0 && /* @__PURE__ */ f("div", {
						className: "via-slider__marks",
						"aria-hidden": "true",
						children: g.map((e) => {
							let t = (e.value - n) / (r - n) * 100;
							return /* @__PURE__ */ p("span", {
								className: `via-slider__mark${t <= .5 ? " is-start" : t >= 99.5 ? " is-end" : ""}`,
								style: { left: `${t}%` },
								children: [/* @__PURE__ */ f("span", { className: "dot" }), e.label && /* @__PURE__ */ f("em", { children: e.label })]
							}, e.value);
						})
					}),
					/* @__PURE__ */ f("input", {
						id: b,
						name: _,
						type: "range",
						min: n,
						max: r,
						step: i,
						value: e,
						onChange: (e) => t(Number(e.target.value)),
						disabled: m,
						"aria-label": a ? void 0 : h,
						"aria-valuetext": l(e)
					})
				]
			}),
			o && /* @__PURE__ */ f("p", {
				className: "via-slider__hint",
				children: o
			})
		]
	});
}
//#endregion
//#region src/lib/Alert/Alert.tsx
var ke = {
	info: /* @__PURE__ */ f(T, {
		size: 15,
		strokeWidth: 1.8
	}),
	attn: /* @__PURE__ */ f(h, {
		size: 15,
		strokeWidth: 1.8
	}),
	danger: /* @__PURE__ */ f(m, {
		size: 15,
		strokeWidth: 2
	}),
	success: /* @__PURE__ */ f(_, {
		size: 15,
		strokeWidth: 2.4
	})
};
function Ae({ tone: e = "info", title: t, children: n, icon: r, action: i, onDismiss: a, size: o = "banner" }) {
	let s = e === "danger" || e === "attn" ? "alert" : "status";
	return /* @__PURE__ */ p("div", {
		className: `via-alert via-alert--${e} via-alert--${o}`,
		role: s,
		children: [
			/* @__PURE__ */ f("span", {
				className: "via-alert__icon",
				"aria-hidden": "true",
				children: r ?? ke[e]
			}),
			/* @__PURE__ */ p("div", {
				className: "via-alert__body",
				children: [t && /* @__PURE__ */ f("strong", {
					className: "via-alert__title",
					children: t
				}), n && /* @__PURE__ */ f("div", {
					className: "via-alert__text",
					children: n
				})]
			}),
			i && /* @__PURE__ */ f("div", {
				className: "via-alert__action",
				children: i
			}),
			a && /* @__PURE__ */ f("button", {
				type: "button",
				className: "via-alert__close",
				onClick: a,
				"aria-label": "Fechar alerta",
				children: /* @__PURE__ */ f(k, {
					size: 13,
					strokeWidth: 2.2
				})
			})
		]
	});
}
//#endregion
//#region src/lib/DataTable/DataTable.tsx
function je({ columns: e, data: t, caption: n, emptyState: r, initialSort: i, sortBy: a, sortDir: o, onSortChange: s, onRowClick: l, density: d = "comfortable", zebra: m = !1 }) {
	let [h, g] = u(i ?? null), _ = c(() => a && o ? {
		key: a,
		dir: o
	} : h, [
		a,
		o,
		h
	]), y = c(() => {
		if (!_) return t;
		let n = e.find((e) => e.key === _.key);
		if (!n) return t;
		let r = (e) => n.accessor ? n.accessor(e) : e[n.key], i = _.dir === "asc" ? 1 : -1;
		return [...t].sort((e, t) => {
			let n = r(e), a = r(t);
			return n == null && a == null ? 0 : n == null ? 1 : a == null ? -1 : n instanceof Date && a instanceof Date ? (n.getTime() - a.getTime()) * i : typeof n == "number" && typeof a == "number" ? (n - a) * i : String(n).localeCompare(String(a), "pt-BR", { numeric: !0 }) * i;
		});
	}, [
		t,
		e,
		_
	]), b = (e) => {
		if (e.sortable === !1) return;
		let t;
		t = !_ || _.key !== e.key ? {
			key: e.key,
			dir: "asc"
		} : _.dir === "asc" ? {
			key: e.key,
			dir: "desc"
		} : null, a === void 0 && g(t), t && s && s(t.key, t.dir);
	};
	return /* @__PURE__ */ p("div", {
		className: `via-dt via-dt--${d} ${m ? "via-dt--zebra" : ""}`,
		children: [n && /* @__PURE__ */ f("header", {
			className: "via-dt__caption",
			children: n
		}), /* @__PURE__ */ f("div", {
			className: "via-dt__scroll",
			children: /* @__PURE__ */ p("table", { children: [/* @__PURE__ */ f("thead", { children: /* @__PURE__ */ f("tr", { children: e.map((e) => {
				let t = _?.key === e.key, n = e.sortable !== !1;
				return /* @__PURE__ */ p("th", {
					style: {
						width: e.width,
						textAlign: e.align ?? "left"
					},
					"aria-sort": t ? _.dir === "asc" ? "ascending" : "descending" : "none",
					children: [n ? /* @__PURE__ */ p("button", {
						type: "button",
						className: `via-dt__sort ${t ? "on" : ""}`,
						onClick: () => b(e),
						children: [/* @__PURE__ */ f("span", { children: e.label }), /* @__PURE__ */ f("span", {
							className: "via-dt__chev",
							"aria-hidden": "true",
							children: t && _.dir === "asc" ? /* @__PURE__ */ f(x, {
								size: 11,
								strokeWidth: 2.4
							}) : t && _.dir === "desc" ? /* @__PURE__ */ f(v, {
								size: 11,
								strokeWidth: 2.4
							}) : /* @__PURE__ */ f(x, {
								size: 11,
								strokeWidth: 1.6,
								className: "muted"
							})
						})]
					}) : /* @__PURE__ */ f("span", {
						className: "via-dt__th-static",
						children: e.label
					}), e.meta && /* @__PURE__ */ f("em", {
						className: "via-dt__th-meta",
						children: e.meta
					})]
				}, e.key);
			}) }) }), /* @__PURE__ */ f("tbody", { children: y.length === 0 ? /* @__PURE__ */ f("tr", { children: /* @__PURE__ */ f("td", {
				colSpan: e.length,
				className: "via-dt__empty",
				children: r ?? /* @__PURE__ */ f("span", { children: "Nada por aqui ainda." })
			}) }) : y.map((t, n) => /* @__PURE__ */ f("tr", {
				className: l ? "is-clickable" : "",
				onClick: l ? () => l(t) : void 0,
				tabIndex: l ? 0 : void 0,
				onKeyDown: l ? (e) => {
					e.key === "Enter" && l(t);
				} : void 0,
				children: e.map((e) => {
					let n = e.render ? e.render(t) : t[e.key];
					return /* @__PURE__ */ f("td", {
						style: { textAlign: e.align ?? "left" },
						children: n
					}, e.key);
				})
			}, n)) })] })
		})]
	});
}
//#endregion
//#region src/lib/HoverCard/HoverCard.tsx
function Me({ trigger: e, children: t, side: n = "bottom", align: r = "center", openDelay: i = 300, closeDelay: a = 200 }) {
	let [c, d] = u(!1), m = l(null), h = l(null), g = l(null), _ = l(null), v = s(), y = () => {
		g.current && clearTimeout(g.current), _.current && clearTimeout(_.current), g.current = null, _.current = null;
	}, b = () => {
		y(), g.current = setTimeout(() => d(!0), i);
	}, x = () => {
		y(), _.current = setTimeout(() => d(!1), a);
	};
	o(() => () => y(), []);
	let S = () => {
		let e = h.current;
		return e ? e.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])") ?? e : null;
	};
	return o(() => {
		let e = S();
		e && (e.setAttribute("aria-haspopup", "dialog"), e.setAttribute("aria-expanded", c ? "true" : "false"));
	}, [c, e]), /* @__PURE__ */ p("span", {
		ref: m,
		className: "via-hovercard-wrap",
		onMouseEnter: b,
		onMouseLeave: x,
		onFocus: b,
		onBlur: x,
		children: [/* @__PURE__ */ f("span", {
			ref: h,
			className: "via-hovercard__trigger",
			children: e
		}), c && /* @__PURE__ */ f("div", {
			className: `via-hovercard via-hovercard--${n} via-hovercard--align-${r}`,
			role: "dialog",
			"aria-labelledby": v,
			onMouseEnter: b,
			onMouseLeave: x,
			children: /* @__PURE__ */ f("div", {
				id: v,
				className: "via-hovercard__body",
				children: t
			})
		})]
	});
}
//#endregion
//#region src/lib/OTPInput/OTPInput.tsx
function Ne({ length: e = 6, value: t, onChange: n, onComplete: r, label: i, hint: a, error: o = !1, autoFocus: s = !0, inputType: c = "numeric", disabled: d = !1 }) {
	let [m, h] = u(""), g = t === void 0 ? m : t, _ = l([]), v = (i) => {
		t === void 0 && h(i), n?.(i), i.length === e && r?.(i);
	}, y = (t, n) => {
		let r = c === "numeric" ? n.replace(/\D/g, "") : n.replace(/\s/g, "");
		if (!r) {
			let e = g.slice(0, t) + g.slice(t + 1);
			e !== g && v(e);
			return;
		}
		let i = r.slice(0, 1), a = g.split("");
		a[t] = i;
		let o = a.join("").slice(0, e);
		o !== g && v(o), t < e - 1 && _.current[t + 1]?.focus();
	}, b = (t, n) => {
		if (!d) if (n.key === "Backspace") {
			if (!g[t] && t > 0) {
				n.preventDefault(), _.current[t - 1]?.focus();
				let e = g.split("");
				e[t - 1] = "", v(e.join(""));
			}
		} else n.key === "ArrowLeft" && t > 0 ? (n.preventDefault(), _.current[t - 1]?.focus()) : n.key === "ArrowRight" && t < e - 1 && (n.preventDefault(), _.current[t + 1]?.focus());
	}, x = (t) => {
		if (d) return;
		t.preventDefault();
		let n = t.clipboardData.getData("text"), r = (c === "numeric" ? n.replace(/\D/g, "") : n.replace(/\s/g, "")).slice(0, e);
		v(r);
		let i = Math.min(r.length, e - 1);
		_.current[i]?.focus();
	}, S = (e, t) => {
		y(e, t.target.value);
	};
	return /* @__PURE__ */ p("div", {
		className: `via-otp${o ? " has-error" : ""}${d ? " is-disabled" : ""}`,
		children: [
			i && /* @__PURE__ */ f("label", {
				className: "via-otp__label",
				children: i
			}),
			/* @__PURE__ */ f("div", {
				className: "via-otp__row",
				role: "group",
				"aria-label": i || "Código de verificação",
				children: Array.from({ length: e }).map((t, n) => /* @__PURE__ */ f("input", {
					ref: (e) => {
						_.current[n] = e;
					},
					type: c === "numeric" ? "tel" : "text",
					inputMode: c === "numeric" ? "numeric" : "text",
					pattern: c === "numeric" ? "[0-9]*" : void 0,
					maxLength: 1,
					autoComplete: n === 0 ? "one-time-code" : "off",
					autoFocus: s && n === 0,
					value: g[n] || "",
					onChange: (e) => S(n, e),
					onKeyDown: (e) => b(n, e),
					onPaste: x,
					disabled: d,
					className: "via-otp__cell",
					"aria-label": `Dígito ${n + 1} de ${e}`,
					"aria-invalid": o || void 0
				}, n))
			}),
			a && /* @__PURE__ */ f("p", {
				className: `via-otp__hint${o ? " is-error" : ""}`,
				children: a
			})
		]
	});
}
//#endregion
//#region src/lib/TagInput/TagInput.tsx
function Pe({ value: e, onChange: t, label: n, placeholder: r = "Digite e pressione Enter…", hint: i, max: a = 0, suggestions: o = [], allowDuplicates: s = !1, error: c = !1, disabled: d = !1, size: m = "md" }) {
	let [h, g] = u([]), _ = e === void 0 ? h : e, [v, y] = u(""), [b, x] = u(!1), S = l(null), C = (n) => {
		e === void 0 && g(n), t?.(n);
	}, w = (e) => {
		let t = e.trim();
		t && (!s && _.includes(t) || a > 0 && _.length >= a || (C([..._, t]), y("")));
	}, T = (e) => {
		d || C(_.filter((t, n) => n !== e));
	}, E = (e) => {
		e.key === "Enter" || e.key === "," ? (e.preventDefault(), w(v)) : e.key === "Backspace" && !v && _.length > 0 && (e.preventDefault(), T(_.length - 1));
	}, D = () => {
		x(!1), v.trim() && w(v);
	}, O = o.filter((e) => !_.includes(e)).slice(0, 5), A = !a || _.length < a;
	return /* @__PURE__ */ p("div", {
		className: `via-taginput via-taginput--${m}${c ? " has-error" : ""}${d ? " is-disabled" : ""}`,
		children: [
			n && /* @__PURE__ */ f("label", {
				className: "via-taginput__label",
				children: n
			}),
			/* @__PURE__ */ p("div", {
				className: `via-taginput__field${b ? " is-focused" : ""}`,
				onClick: () => S.current?.focus(),
				role: "presentation",
				children: [_.map((e, t) => /* @__PURE__ */ p("span", {
					className: "via-taginput__tag",
					children: [/* @__PURE__ */ f("span", { children: e }), !d && /* @__PURE__ */ f("button", {
						type: "button",
						onClick: (e) => {
							e.stopPropagation(), T(t);
						},
						"aria-label": `Remover ${e}`,
						className: "via-taginput__remove",
						children: /* @__PURE__ */ f(k, {
							size: 11,
							strokeWidth: 2.4
						})
					})]
				}, `${e}-${t}`)), /* @__PURE__ */ f("input", {
					ref: S,
					className: "via-taginput__input",
					type: "text",
					value: v,
					placeholder: A ? r : "",
					disabled: d || !A,
					onChange: (e) => y(e.target.value),
					onKeyDown: E,
					onFocus: () => x(!0),
					onBlur: D
				})]
			}),
			O.length > 0 && !d && A && /* @__PURE__ */ p("div", {
				className: "via-taginput__suggestions",
				children: [/* @__PURE__ */ f("span", {
					className: "via-taginput__suggestions-label",
					children: "Sugestões"
				}), /* @__PURE__ */ f("ul", {
					className: "via-taginput__suggestions-list",
					role: "list",
					children: O.map((e) => /* @__PURE__ */ f("li", {
						className: "via-taginput__suggestion-item",
						children: /* @__PURE__ */ p("button", {
							type: "button",
							className: "via-taginput__suggestion",
							onClick: () => w(e),
							children: ["+ ", e]
						})
					}, e))
				})]
			}),
			i && /* @__PURE__ */ p("p", {
				className: `via-taginput__hint${c ? " is-error" : ""}`,
				children: [i, a > 0 && /* @__PURE__ */ p("span", {
					className: "via-taginput__count",
					children: [
						" ",
						"· ",
						_.length,
						"/",
						a
					]
				})]
			})
		]
	});
}
//#endregion
//#region src/lib/Calendar/Calendar.tsx
var J = (e, t) => e.getFullYear() === t.getFullYear() && e.getMonth() === t.getMonth() && e.getDate() === t.getDate(), Fe = (e) => new Date(e.getFullYear(), e.getMonth(), 1), Y = (e, t) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + t), Ie = (e, t) => new Date(e.getFullYear(), e.getMonth() + t, e.getDate());
function Le({ value: e, onChange: t, defaultMonth: n, min: r, max: i, locale: a = "pt-BR", showWeekdays: d = !0, markers: m = [] }) {
	let h = s(), g = /* @__PURE__ */ new Date(), [_, v] = u(n || (e ? new Date(e.getFullYear(), e.getMonth(), 1) : new Date(g.getFullYear(), g.getMonth(), 1))), x = (e) => !!(r && e < new Date(r.getFullYear(), r.getMonth(), r.getDate()) || i && e > new Date(i.getFullYear(), i.getMonth(), i.getDate())), S = (() => {
		if (e && e.getMonth() === _.getMonth() && e.getFullYear() === _.getFullYear() && !x(e)) return new Date(e.getFullYear(), e.getMonth(), e.getDate());
		if (g.getMonth() === _.getMonth() && g.getFullYear() === _.getFullYear() && !x(g)) return new Date(g.getFullYear(), g.getMonth(), g.getDate());
		let t = new Date(_.getFullYear(), _.getMonth() + 1, 0).getDate();
		for (let e = 1; e <= t; e++) {
			let t = new Date(_.getFullYear(), _.getMonth(), e);
			if (!x(t)) return t;
		}
		return Fe(_);
	})(), [C, w] = u(S), T = l(null), E = (e) => `${h}-day-${e.getFullYear()}-${e.getMonth()}-${e.getDate()}`, { days: D, weekdayLabels: O, monthLabel: k } = c(() => {
		let e = new Intl.DateTimeFormat(a, {
			month: "long",
			year: "numeric"
		}).format(_), t = new Intl.DateTimeFormat(a, { weekday: "short" }), n = new Date(2024, 5, 2), r = Array.from({ length: 7 }).map((e, r) => {
			let i = new Date(n);
			return i.setDate(n.getDate() + r), t.format(i).replace(".", "").slice(0, 3);
		}), i = new Date(_.getFullYear(), _.getMonth(), 1), o = i.getDay(), s = new Date(_.getFullYear(), _.getMonth() + 1, 0).getDate(), c = [];
		for (let e = 0; e < o; e++) {
			let t = new Date(i);
			t.setDate(t.getDate() - (o - e)), c.push({
				date: t,
				outOfMonth: !0
			});
		}
		for (let e = 1; e <= s; e++) c.push({
			date: new Date(_.getFullYear(), _.getMonth(), e),
			outOfMonth: !1
		});
		for (; c.length % 7 != 0 || c.length < 42;) {
			let e = c[c.length - 1]?.date;
			if (!e) break;
			let t = new Date(e);
			if (t.setDate(t.getDate() + 1), c.push({
				date: t,
				outOfMonth: t.getMonth() !== _.getMonth()
			}), c.length >= 42) break;
		}
		return {
			days: c,
			weekdayLabels: r,
			monthLabel: e
		};
	}, [_, a]);
	o(() => {
		C.getMonth() === _.getMonth() && C.getFullYear() === _.getFullYear() || T.current || w(S);
	}, [_]), o(() => {
		let e = T.current;
		e && (T.current = null, document.getElementById(E(e))?.focus());
	}, [C, _]);
	let A = () => v(new Date(_.getFullYear(), _.getMonth() - 1, 1)), j = () => v(new Date(_.getFullYear(), _.getMonth() + 1, 1)), M = (e, t) => {
		if (t === 0) return e;
		let n = e;
		for (let e = 0; e < 366; e++) {
			if (!x(n)) return n;
			n = Y(n, t > 0 ? 1 : -1);
		}
		return e;
	}, N = (e) => {
		let t = x(e) ? M(e, e >= C ? 1 : -1) : e;
		x(t) || (T.current = t, w(t), (t.getMonth() !== _.getMonth() || t.getFullYear() !== _.getFullYear()) && v(Fe(t)));
	}, P = (e, n) => {
		if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
			e.preventDefault(), x(n) || t?.(n);
			return;
		}
		let r;
		switch (e.key) {
			case "ArrowLeft":
				r = Y(n, -1);
				break;
			case "ArrowRight":
				r = Y(n, 1);
				break;
			case "ArrowUp":
				r = Y(n, -7);
				break;
			case "ArrowDown":
				r = Y(n, 7);
				break;
			case "Home":
				r = Y(n, -n.getDay());
				break;
			case "End":
				r = Y(n, 6 - n.getDay());
				break;
			case "PageUp":
				r = Ie(n, -1);
				break;
			case "PageDown":
				r = Ie(n, 1);
				break;
			default: return;
		}
		e.preventDefault(), N(r);
	};
	return /* @__PURE__ */ p("div", {
		className: "via-cal",
		role: "application",
		"aria-label": "Calendário",
		children: [
			/* @__PURE__ */ p("div", {
				className: "via-cal__head",
				children: [
					/* @__PURE__ */ f("button", {
						type: "button",
						className: "via-cal__nav",
						onClick: A,
						"aria-label": "Mês anterior",
						children: /* @__PURE__ */ f(y, {
							size: 14,
							strokeWidth: 2.2
						})
					}),
					/* @__PURE__ */ f("h4", {
						className: "via-cal__month",
						children: k
					}),
					/* @__PURE__ */ f("button", {
						type: "button",
						className: "via-cal__nav",
						onClick: j,
						"aria-label": "Próximo mês",
						children: /* @__PURE__ */ f(b, {
							size: 14,
							strokeWidth: 2.2
						})
					})
				]
			}),
			d && /* @__PURE__ */ f("div", {
				className: "via-cal__weekdays",
				"aria-hidden": "true",
				children: O.map((e) => /* @__PURE__ */ f("span", { children: e }, e))
			}),
			/* @__PURE__ */ f("div", {
				className: "via-cal__grid",
				role: "grid",
				children: D.map(({ date: n, outOfMonth: r }, i) => {
					if (!n) return /* @__PURE__ */ f("span", { className: "via-cal__cell-empty" }, i);
					let o = J(n, g), s = e && J(n, e), c = x(n), l = J(n, C), u = m.filter((e) => J(e.date, n));
					return /* @__PURE__ */ p("button", {
						id: E(n),
						type: "button",
						className: [
							"via-cal__cell",
							r ? "is-out" : "",
							o ? "is-today" : "",
							s ? "is-selected" : "",
							c ? "is-disabled" : ""
						].filter(Boolean).join(" "),
						disabled: c,
						tabIndex: c ? -1 : l ? 0 : -1,
						onClick: () => {
							c || (w(new Date(n.getFullYear(), n.getMonth(), n.getDate())), t?.(n));
						},
						onKeyDown: (e) => P(e, n),
						"aria-label": n.toLocaleDateString(a, {
							weekday: "long",
							day: "numeric",
							month: "long",
							year: "numeric"
						}),
						"aria-current": o ? "date" : void 0,
						"aria-selected": !!s,
						children: [/* @__PURE__ */ f("span", {
							className: "via-cal__cell-num",
							children: n.getDate()
						}), u.length > 0 && /* @__PURE__ */ f("span", {
							className: "via-cal__cell-markers",
							"aria-hidden": "true",
							children: u.slice(0, 3).map((e, t) => /* @__PURE__ */ f("span", {
								className: `via-cal__cell-dot via-cal__cell-dot--${e.tone || "navy"}`,
								title: e.label
							}, t))
						})]
					}, i);
				})
			})
		]
	});
}
//#endregion
//#region src/lib/Carousel/Carousel.tsx
function Re({ children: e, index: t, onIndexChange: n, showArrows: r = !0, showDots: i = !0, autoPlay: a = 0, loop: s = !0, label: c = "Carrossel" }) {
	let [m, h] = u(0), g = t === void 0 ? m : t, _ = e.length, v = l(null), x = l(null), S = (e) => {
		let r = e;
		r < 0 && (r = s ? _ - 1 : 0), r >= _ && (r = s ? 0 : _ - 1), t === void 0 && h(r), n?.(r);
	}, C = () => S(g - 1), w = () => S(g + 1);
	return o(() => {
		if (!a || a <= 0) return;
		let e = setInterval(() => {
			S(g + 1);
		}, a);
		return () => clearInterval(e);
	}, [
		g,
		a,
		_,
		s
	]), /* @__PURE__ */ p("div", {
		className: "via-carousel",
		role: "region",
		"aria-label": c,
		"aria-roledescription": "carousel",
		onKeyDown: (e) => {
			e.key === "ArrowLeft" && C(), e.key === "ArrowRight" && w();
		},
		tabIndex: 0,
		children: [/* @__PURE__ */ p("div", {
			className: "via-carousel__viewport",
			onTouchStart: (e) => {
				x.current = e.touches[0].clientX;
			},
			onTouchEnd: (e) => {
				if (x.current === null) return;
				let t = e.changedTouches[0].clientX - x.current;
				Math.abs(t) > 40 && (t > 0 ? C() : w()), x.current = null;
			},
			children: [/* @__PURE__ */ f("div", {
				ref: v,
				className: "via-carousel__track",
				style: { transform: `translate3d(-${g * 100}%, 0, 0)` },
				"aria-live": "polite",
				children: e.map((e, t) => /* @__PURE__ */ f("div", {
					className: "via-carousel__slide",
					role: "group",
					"aria-roledescription": "slide",
					"aria-label": `Slide ${t + 1} de ${_}`,
					"aria-hidden": t !== g,
					children: e
				}, t))
			}), r && _ > 1 && /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f("button", {
				type: "button",
				className: "via-carousel__arrow via-carousel__arrow--prev",
				onClick: C,
				"aria-label": "Slide anterior",
				disabled: !s && g === 0,
				children: /* @__PURE__ */ f(y, {
					size: 16,
					strokeWidth: 2.2
				})
			}), /* @__PURE__ */ f("button", {
				type: "button",
				className: "via-carousel__arrow via-carousel__arrow--next",
				onClick: w,
				"aria-label": "Próximo slide",
				disabled: !s && g === _ - 1,
				children: /* @__PURE__ */ f(b, {
					size: 16,
					strokeWidth: 2.2
				})
			})] })]
		}), i && _ > 1 && /* @__PURE__ */ f("div", {
			className: "via-carousel__dots",
			role: "tablist",
			children: e.map((e, t) => /* @__PURE__ */ f("button", {
				type: "button",
				role: "tab",
				"aria-selected": t === g,
				"aria-label": `Ir pro slide ${t + 1}`,
				className: `via-carousel__dot${t === g ? " is-active" : ""}`,
				onClick: () => S(t)
			}, t))
		})]
	});
}
//#endregion
//#region src/lib/TimePicker/TimePicker.tsx
var X = (e) => String(e).padStart(2, "0");
function ze({ value: e, onChange: t, label: n, hint: r, step: i = 15, min: a, max: o, error: s = !1, disabled: c = !1, size: d = "md" }) {
	let m = e !== void 0, [h, g] = u(""), _ = m ? e : h, v = l(null), y = l(null), [b, x] = (_ || ":").split(":"), [C, w] = u(null), [T, E] = u(null), D = C ?? b ?? "", O = T ?? x ?? "", k = (e, n) => {
		let r = Math.max(0, Math.min(23, parseInt(e || "0", 10) || 0)), i = Math.max(0, Math.min(59, parseInt(n || "0", 10) || 0)), a = `${X(r)}:${X(i)}`;
		m || g(a), t?.(a);
	}, A = (e) => {
		let t = e.target.value.replace(/\D/g, "").slice(0, 2);
		w(t), k(t, O), t.length === 2 && y.current?.focus();
	}, j = (e) => {
		let t = e.target.value.replace(/\D/g, "").slice(0, 2);
		E(t), k(D, t);
	}, M = () => {
		w(null), E(null);
	}, N = (e) => {
		if (c) return;
		let n = parseInt(b || "0", 10) || 0, r = parseInt(x || "0", 10) || 0;
		for (r += e * i; r < 0;) r += 60, n = (n - 1 + 24) % 24;
		for (; r >= 60;) r -= 60, n = (n + 1) % 24;
		let s = `${X(n)}:${X(r)}`;
		a && s < a || o && s > o || (w(null), E(null), m || g(s), t?.(s));
	};
	return /* @__PURE__ */ p("div", {
		className: `via-tp via-tp--${d}${s ? " has-error" : ""}${c ? " is-disabled" : ""}`,
		children: [
			n && /* @__PURE__ */ f("label", {
				className: "via-tp__label",
				children: n
			}),
			/* @__PURE__ */ p("div", {
				className: "via-tp__field",
				children: [
					/* @__PURE__ */ f(S, {
						size: 14,
						strokeWidth: 1.8,
						className: "via-tp__icon"
					}),
					/* @__PURE__ */ f("input", {
						ref: v,
						type: "text",
						inputMode: "numeric",
						maxLength: 2,
						placeholder: "HH",
						value: D,
						onChange: A,
						onBlur: M,
						disabled: c,
						className: "via-tp__cell",
						"aria-label": "Hora"
					}),
					/* @__PURE__ */ f("span", {
						className: "via-tp__sep",
						children: ":"
					}),
					/* @__PURE__ */ f("input", {
						ref: y,
						type: "text",
						inputMode: "numeric",
						maxLength: 2,
						placeholder: "MM",
						value: O,
						onChange: j,
						onBlur: M,
						disabled: c,
						className: "via-tp__cell",
						"aria-label": "Minuto"
					}),
					/* @__PURE__ */ p("div", {
						className: "via-tp__steps",
						"aria-hidden": "true",
						children: [/* @__PURE__ */ f("button", {
							type: "button",
							onClick: () => N(1),
							disabled: c,
							children: "▲"
						}), /* @__PURE__ */ f("button", {
							type: "button",
							onClick: () => N(-1),
							disabled: c,
							children: "▼"
						})]
					})
				]
			}),
			r && /* @__PURE__ */ f("p", {
				className: `via-tp__hint${s ? " is-error" : ""}`,
				children: r
			})
		]
	});
}
//#endregion
//#region src/lib/Sheet/Sheet.tsx
function Be({ open: e, onClose: t, title: n, description: r, children: i, footer: a, maxHeight: c = "85vh", showHandle: u = !0 }) {
	let d = l(null), m = s(), h = `${m}-title`, g = `${m}-description`;
	o(() => {
		if (!e) return;
		let n = (e) => {
			e.key === "Escape" && t();
		};
		return document.addEventListener("keydown", n), document.body.style.overflow = "hidden", () => {
			document.removeEventListener("keydown", n), document.body.style.overflow = "";
		};
	}, [e, t]);
	let { onKeyDown: _ } = U(e, d);
	return e ? /* @__PURE__ */ p("div", {
		className: "via-sheet-root",
		role: "presentation",
		children: [/* @__PURE__ */ f("div", {
			className: "via-sheet-scrim",
			onClick: t,
			"aria-hidden": "true"
		}), /* @__PURE__ */ p("div", {
			ref: d,
			className: "via-sheet",
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": n ? h : void 0,
			"aria-describedby": r ? g : void 0,
			tabIndex: -1,
			onKeyDown: _,
			style: { maxHeight: c },
			children: [
				u && /* @__PURE__ */ f("span", {
					className: "via-sheet__handle",
					"aria-hidden": "true"
				}),
				(n || r) && /* @__PURE__ */ p("header", {
					className: "via-sheet__head",
					children: [/* @__PURE__ */ p("div", {
						className: "via-sheet__head-text",
						children: [n && /* @__PURE__ */ f("h2", {
							id: h,
							children: n
						}), r && /* @__PURE__ */ f("p", {
							id: g,
							children: r
						})]
					}), /* @__PURE__ */ f("button", {
						type: "button",
						className: "via-sheet__close",
						onClick: t,
						"aria-label": "Fechar",
						children: /* @__PURE__ */ f(k, {
							size: 16,
							strokeWidth: 1.8
						})
					})]
				}),
				/* @__PURE__ */ f("div", {
					className: "via-sheet__body",
					children: i
				}),
				a && /* @__PURE__ */ f("footer", {
					className: "via-sheet__foot",
					children: a
				})
			]
		})]
	}) : null;
}
//#endregion
//#region src/lib/ContextMenu/ContextMenu.tsx
function Ve({ children: e, items: t, label: n = "Menu de contexto" }) {
	let [r, i] = u(!1), [a, s] = u({
		x: 0,
		y: 0
	}), [c, m] = u(-1), h = l(null), g = l([]), _ = (e) => {
		e.preventDefault(), s({
			x: e.clientX,
			y: e.clientY
		}), m(y()), i(!0);
	}, v = () => i(!1), y = () => t.findIndex((e) => !e.disabled), b = () => {
		for (let e = t.length - 1; e >= 0; e--) if (!t[e].disabled) return e;
		return -1;
	}, x = (e, n) => {
		if (t.length === 0) return -1;
		let r = e;
		for (let e = 0; e < t.length; e++) if (r = (r + n + t.length) % t.length, !t[r].disabled) return r;
		return -1;
	}, S = (e) => {
		e < 0 || (m(e), g.current[e]?.focus());
	}, C = (e) => {
		let n = t[e];
		!n || n.disabled || (n.onSelect?.(), v());
	}, w = (e, t) => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault(), S(x(t, 1));
				break;
			case "ArrowUp":
				e.preventDefault(), S(x(t, -1));
				break;
			case "Home":
				e.preventDefault(), S(y());
				break;
			case "End":
				e.preventDefault(), S(b());
				break;
			case "Enter":
			case " ":
				e.preventDefault(), C(t);
				break;
			default: break;
		}
	};
	return o(() => {
		if (!r) return;
		let e = (e) => {
			e.key === "Escape" && v();
		}, t = (e) => {
			h.current && !h.current.contains(e.target) && v();
		};
		return document.addEventListener("keydown", e), document.addEventListener("mousedown", t), () => {
			document.removeEventListener("keydown", e), document.removeEventListener("mousedown", t);
		};
	}, [r]), o(() => {
		if (!r || !h.current) return;
		let e = h.current.getBoundingClientRect(), t = window.innerWidth, n = window.innerHeight, i = a.x, o = a.y;
		i + e.width > t - 8 && (i = t - e.width - 8), o + e.height > n - 8 && (o = n - e.height - 8), (i !== a.x || o !== a.y) && s({
			x: i,
			y: o
		});
	}, [r]), o(() => {
		r && c >= 0 && g.current[c]?.focus();
	}, [r]), /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f("span", {
		onContextMenu: _,
		className: "via-cm-wrap",
		children: e
	}), r && /* @__PURE__ */ f("div", {
		ref: h,
		className: "via-cm",
		role: "menu",
		"aria-label": n,
		style: {
			top: a.y,
			left: a.x
		},
		children: t.map((e, t) => /* @__PURE__ */ p("div", { children: [e.separatorBefore && /* @__PURE__ */ f("div", {
			className: "via-cm__sep",
			role: "separator"
		}), /* @__PURE__ */ p("button", {
			ref: (e) => {
				g.current[t] = e;
			},
			type: "button",
			role: "menuitem",
			tabIndex: t === c ? 0 : -1,
			className: `via-cm__item${e.destructive ? " is-destructive" : ""}${e.disabled ? " is-disabled" : ""}`,
			onClick: () => {
				e.disabled || (e.onSelect?.(), v());
			},
			onKeyDown: (e) => w(e, t),
			disabled: e.disabled,
			children: [
				e.icon && /* @__PURE__ */ f("span", {
					className: "via-cm__icon",
					children: e.icon
				}),
				/* @__PURE__ */ f("span", {
					className: "via-cm__label",
					children: e.label
				}),
				e.shortcut && /* @__PURE__ */ f("span", {
					className: "via-cm__shortcut",
					children: e.shortcut
				})
			]
		})] }, t))
	})] });
}
//#endregion
//#region src/lib/MultiSelect/MultiSelect.tsx
function He({ options: e, value: t, onChange: n, label: r, placeholder: i = "Selecione…", hint: a, error: c = !1, disabled: d = !1, max: m = 0, size: h = "md" }) {
	let [g, y] = u([]), b = t === void 0 ? g : t, [x, S] = u(!1), [C, w] = u(-1), T = l(null), E = l(null), D = s(), O = `${D}-label`, A = `${D}-list`, j = (e) => `${D}-opt-${e}`, M = (e) => {
		t === void 0 && y(e), n?.(e);
	}, N = (e) => {
		if (b.includes(e)) M(b.filter((t) => t !== e));
		else {
			if (m > 0 && b.length >= m) return;
			M([...b, e]);
		}
	}, P = (t, n) => {
		let r = e.length;
		if (r === 0) return -1;
		for (let i = 1; i <= r; i++) {
			let a = (t + n * i + r * i) % r;
			if (!e[a]?.disabled) return a;
		}
		return -1;
	}, F = () => P(-1, 1), I = () => P(0, -1), L = () => {
		let t = e.findIndex((e) => b.includes(e.value) && !e.disabled);
		w(t >= 0 ? t : F()), S(!0);
	}, R = (e = !1) => {
		w(-1), S(!1), e && E.current?.focus();
	}, z = () => x ? R() : L();
	o(() => {
		if (!x) return;
		let e = (e) => {
			T.current && !T.current.contains(e.target) && R();
		};
		return document.addEventListener("mousedown", e), () => {
			document.removeEventListener("mousedown", e);
		};
	}, [x]);
	let B = (t) => {
		if (!x) {
			(t.key === "ArrowDown" || t.key === "ArrowUp" || t.key === "Enter" || t.key === " ") && (t.preventDefault(), L());
			return;
		}
		switch (t.key) {
			case "ArrowDown":
				t.preventDefault(), w((e) => P(e, 1));
				break;
			case "ArrowUp":
				t.preventDefault(), w((e) => P(e, -1));
				break;
			case "Home":
				t.preventDefault(), w(F());
				break;
			case "End":
				t.preventDefault(), w(I());
				break;
			case "Enter":
			case " ": {
				t.preventDefault();
				let n = e[C];
				if (!n || n.disabled) break;
				let r = b.includes(n.value);
				(!m || b.length < m || r) && N(n.value);
				break;
			}
			case "Escape":
				t.preventDefault(), R(!0);
				break;
			default: break;
		}
	}, V = b.map((t) => e.find((e) => e.value === t)).filter(Boolean);
	return /* @__PURE__ */ p("div", {
		ref: T,
		className: `via-ms via-ms--${h}${c ? " has-error" : ""}${d ? " is-disabled" : ""}`,
		children: [
			r && /* @__PURE__ */ f("label", {
				id: O,
				className: "via-ms__label",
				children: r
			}),
			/* @__PURE__ */ p("button", {
				ref: E,
				type: "button",
				className: `via-ms__trigger${x ? " is-open" : ""}`,
				onClick: () => !d && z(),
				onKeyDown: B,
				disabled: d,
				"aria-haspopup": "listbox",
				"aria-expanded": x,
				"aria-controls": x ? A : void 0,
				"aria-activedescendant": x && C >= 0 ? j(C) : void 0,
				...r ? { "aria-labelledby": O } : { "aria-label": i },
				children: [/* @__PURE__ */ p("div", {
					className: "via-ms__chips",
					children: [V.length === 0 && /* @__PURE__ */ f("span", {
						className: "via-ms__placeholder",
						children: i
					}), V.map((e) => /* @__PURE__ */ p("span", {
						className: "via-ms__chip",
						children: [/* @__PURE__ */ f("span", { children: e.label }), !d && /* @__PURE__ */ f("button", {
							type: "button",
							onClick: (t) => {
								t.stopPropagation(), N(e.value);
							},
							"aria-label": `Remover ${e.label}`,
							className: "via-ms__chip-remove",
							children: /* @__PURE__ */ f(k, {
								size: 10,
								strokeWidth: 2.4
							})
						})]
					}, e.value))]
				}), /* @__PURE__ */ f(v, {
					size: 14,
					strokeWidth: 2,
					className: "via-ms__chev",
					style: { transform: x ? "rotate(180deg)" : void 0 }
				})]
			}),
			x && /* @__PURE__ */ f("ul", {
				id: A,
				className: "via-ms__list",
				role: "listbox",
				"aria-multiselectable": "true",
				...r ? { "aria-labelledby": O } : { "aria-label": i },
				children: e.map((e, t) => {
					let n = b.includes(e.value), r = !m || b.length < m || n, i = t === C;
					return /* @__PURE__ */ p("li", {
						id: j(t),
						className: `via-ms__option${n ? " is-selected" : ""}${i ? " is-active" : ""}${e.disabled || !r ? " is-disabled" : ""}`,
						onClick: () => !e.disabled && r && N(e.value),
						onMouseEnter: () => !e.disabled && w(t),
						role: "option",
						"aria-selected": n,
						children: [/* @__PURE__ */ f("span", {
							className: "via-ms__option-check",
							children: n && /* @__PURE__ */ f(_, {
								size: 11,
								strokeWidth: 3
							})
						}), /* @__PURE__ */ f("span", { children: e.label })]
					}, e.value);
				})
			}),
			a && /* @__PURE__ */ p("p", {
				className: `via-ms__hint${c ? " is-error" : ""}`,
				children: [a, m > 0 && /* @__PURE__ */ p("span", {
					className: "via-ms__count",
					children: [
						" ",
						"· ",
						b.length,
						"/",
						m
					]
				})]
			})
		]
	});
}
//#endregion
//#region src/lib/DateRangePicker/DateRangePicker.tsx
var Ue = (e, t) => e.getFullYear() === t.getFullYear() && e.getMonth() === t.getMonth() && e.getDate() === t.getDate();
function We({ value: e, onChange: t, defaultMonth: n, min: r, max: i, locale: a = "pt-BR", showPresets: o = !1 }) {
	let [s, c] = u({
		start: null,
		end: null
	}), l = e || s, d = (n) => {
		e === void 0 && c(n), t?.(n);
	}, m = (e) => {
		!l.start || l.start && l.end || Ue(e, l.start) ? d({
			start: e,
			end: null
		}) : e < l.start ? d({
			start: e,
			end: l.start
		}) : d({
			start: l.start,
			end: e
		});
	}, h = (e) => {
		let t = /* @__PURE__ */ new Date(), n = /* @__PURE__ */ new Date();
		n.setDate(t.getDate() - e), d({
			start: n,
			end: t
		});
	}, g = [];
	if (l.start && l.end) {
		let e = new Date(l.start);
		for (; e <= l.end;) g.push({
			date: new Date(e),
			tone: "navy"
		}), e.setDate(e.getDate() + 1);
	}
	let _ = (e) => e.toLocaleDateString(a, {
		day: "2-digit",
		month: "short",
		year: "numeric"
	});
	return /* @__PURE__ */ p("div", {
		className: "via-drp",
		children: [
			/* @__PURE__ */ p("header", {
				className: "via-drp__head",
				children: [
					/* @__PURE__ */ p("div", {
						className: "via-drp__field",
						children: [/* @__PURE__ */ f("span", {
							className: "via-drp__label",
							children: "Início"
						}), /* @__PURE__ */ f("strong", { children: l.start ? _(l.start) : "—" })]
					}),
					/* @__PURE__ */ f("span", {
						className: "via-drp__sep",
						children: "→"
					}),
					/* @__PURE__ */ p("div", {
						className: "via-drp__field",
						children: [/* @__PURE__ */ f("span", {
							className: "via-drp__label",
							children: "Fim"
						}), /* @__PURE__ */ f("strong", { children: l.end ? _(l.end) : "—" })]
					})
				]
			}),
			o && /* @__PURE__ */ p("div", {
				className: "via-drp__presets",
				children: [
					/* @__PURE__ */ f("button", {
						type: "button",
						onClick: () => h(7),
						children: "Últimos 7 dias"
					}),
					/* @__PURE__ */ f("button", {
						type: "button",
						onClick: () => h(30),
						children: "Últimos 30 dias"
					}),
					/* @__PURE__ */ f("button", {
						type: "button",
						onClick: () => h(90),
						children: "Últimos 90 dias"
					})
				]
			}),
			/* @__PURE__ */ f(Le, {
				value: l.start && !l.end ? l.start : null,
				onChange: m,
				defaultMonth: n,
				min: r,
				max: i,
				locale: a,
				markers: g
			}),
			l.start && l.end && /* @__PURE__ */ p("p", {
				className: "via-drp__summary",
				children: [
					/* @__PURE__ */ f("strong", { children: Math.ceil((l.end.getTime() - l.start.getTime()) / 864e5) + 1 }),
					" ",
					"dias selecionados"
				]
			})
		]
	});
}
//#endregion
//#region src/lib/TreeView/TreeView.tsx
function Ge({ nodes: e, defaultExpanded: t = [], expanded: n, onExpandedChange: r, selected: i, onSelect: a, label: o = "Árvore" }) {
	let c = s(), [l, d] = u(new Set(t)), m = n ? new Set(n) : l, [h, g] = u(null), _ = (e) => {
		n === void 0 && d(e), r?.(Array.from(e));
	}, v = (e) => {
		if (m.has(e)) return;
		let t = new Set(m);
		t.add(e), _(t);
	}, y = (e) => {
		if (!m.has(e)) return;
		let t = new Set(m);
		t.delete(e), _(t);
	}, x = (e) => {
		let t = new Set(m);
		t.has(e) ? t.delete(e) : t.add(e), _(t);
	}, S = (() => {
		let t = [], n = (e, r, i) => {
			for (let a of e) {
				let e = !!a.children && a.children.length > 0, o = m.has(a.id);
				t.push({
					node: a,
					depth: r,
					hasChildren: e,
					isExpanded: o,
					parentId: i
				}), e && o && n(a.children, r + 1, a.id);
			}
		};
		return n(e, 0, null), t;
	})(), C = h && S.some((e) => e.node.id === h) ? h : i && S.some((e) => e.node.id === i) ? i : S[0]?.node.id ?? null, w = (e) => {
		g(e), document.getElementById(`${c}-row-${e}`)?.focus();
	}, T = (e, t) => {
		let n = S[t];
		if (n) switch (e.key) {
			case "ArrowDown": {
				e.preventDefault();
				let n = S[t + 1];
				n && w(n.node.id);
				break;
			}
			case "ArrowUp": {
				e.preventDefault();
				let n = S[t - 1];
				n && w(n.node.id);
				break;
			}
			case "Home": {
				e.preventDefault();
				let t = S[0];
				t && w(t.node.id);
				break;
			}
			case "End": {
				e.preventDefault();
				let t = S[S.length - 1];
				t && w(t.node.id);
				break;
			}
			case "ArrowRight":
				if (e.preventDefault(), n.hasChildren && !n.isExpanded) v(n.node.id);
				else if (n.hasChildren && n.isExpanded) {
					let e = S[t + 1];
					e && e.parentId === n.node.id && w(e.node.id);
				}
				break;
			case "ArrowLeft":
				e.preventDefault(), n.hasChildren && n.isExpanded ? y(n.node.id) : n.parentId && w(n.parentId);
				break;
			case "Enter":
			case " ":
			case "Spacebar":
				e.preventDefault(), n.hasChildren && x(n.node.id), a?.(n.node.id);
				break;
			default: break;
		}
	}, E = (e, t) => {
		let { node: n, depth: r, hasChildren: o, isExpanded: s } = e, l = i === n.id, u = n.id === C;
		return /* @__PURE__ */ p("li", {
			role: "treeitem",
			"aria-expanded": o ? s : void 0,
			"aria-selected": l,
			children: [/* @__PURE__ */ p("button", {
				type: "button",
				id: `${c}-row-${n.id}`,
				tabIndex: u ? 0 : -1,
				className: `via-tv__row${l ? " is-selected" : ""}${n.highlighted ? " is-highlighted" : ""}`,
				style: { paddingLeft: `${10 + r * 18}px` },
				onClick: () => {
					g(n.id), o && x(n.id), a?.(n.id);
				},
				onKeyDown: (e) => T(e, t),
				children: [
					/* @__PURE__ */ f("span", {
						className: `via-tv__chev${o ? "" : " is-leaf"}${s ? " is-open" : ""}`,
						"aria-hidden": "true",
						children: o && /* @__PURE__ */ f(b, {
							size: 12,
							strokeWidth: 2.2
						})
					}),
					n.icon && /* @__PURE__ */ f("span", {
						className: "via-tv__icon",
						children: n.icon
					}),
					/* @__PURE__ */ f("span", {
						className: "via-tv__label",
						children: n.label
					}),
					typeof n.count == "number" && /* @__PURE__ */ f("span", {
						className: "via-tv__count",
						children: n.count
					})
				]
			}), o && s && /* @__PURE__ */ f("ul", {
				role: "group",
				className: "via-tv__children",
				children: n.children.map((e) => {
					let t = S.findIndex((t) => t.node.id === e.id), n = S[t];
					return n ? E(n, t) : null;
				})
			})]
		}, n.id);
	};
	return /* @__PURE__ */ f("ul", {
		role: "tree",
		"aria-label": o,
		className: "via-tv",
		children: e.map((e) => {
			let t = S.findIndex((t) => t.node.id === e.id), n = S[t];
			return n ? E(n, t) : null;
		})
	});
}
//#endregion
//#region src/lib/Splitter/Splitter.tsx
function Ke({ start: e, end: t, orientation: n = "horizontal", defaultSplit: r = 50, split: a, onSplitChange: o, min: s = 15, max: c = 85, handleLabel: d = "Redimensionar painéis" }) {
	let [m, h] = u(r), g = a ?? m, _ = l(null), v = i((e) => {
		let t = Math.max(s, Math.min(c, e));
		a === void 0 && h(t), o?.(t);
	}, [
		a,
		o,
		s,
		c
	]), y = (e) => {
		e.preventDefault();
		let t = _.current;
		if (!t) return;
		let r = t.getBoundingClientRect(), i = (e) => {
			v(n === "horizontal" ? (e.clientX - r.left) / r.width * 100 : (e.clientY - r.top) / r.height * 100);
		}, a = () => {
			document.removeEventListener("mousemove", i), document.removeEventListener("mouseup", a), document.body.style.cursor = "";
		};
		document.addEventListener("mousemove", i), document.addEventListener("mouseup", a), document.body.style.cursor = n === "horizontal" ? "col-resize" : "row-resize";
	}, b = (e) => {
		let t = e.shiftKey ? 5 : 1;
		n === "horizontal" ? (e.key === "ArrowLeft" && (e.preventDefault(), v(g - t)), e.key === "ArrowRight" && (e.preventDefault(), v(g + t))) : (e.key === "ArrowUp" && (e.preventDefault(), v(g - t)), e.key === "ArrowDown" && (e.preventDefault(), v(g + t))), e.key === "Home" && (e.preventDefault(), v(s)), e.key === "End" && (e.preventDefault(), v(c));
	}, x = n === "horizontal" ? { width: `${g}%` } : { height: `${g}%` }, S = n === "horizontal" ? { width: `${100 - g}%` } : { height: `${100 - g}%` };
	return /* @__PURE__ */ p("div", {
		ref: _,
		className: `via-splitter via-splitter--${n}`,
		children: [
			/* @__PURE__ */ f("div", {
				className: "via-splitter__pane",
				style: x,
				children: e
			}),
			/* @__PURE__ */ f("button", {
				type: "button",
				className: "via-splitter__handle",
				onMouseDown: y,
				onKeyDown: b,
				role: "separator",
				"aria-orientation": n,
				"aria-label": d,
				"aria-valuenow": g,
				"aria-valuemin": s,
				"aria-valuemax": c,
				children: /* @__PURE__ */ f("span", {
					className: "via-splitter__grip",
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ f("div", {
				className: "via-splitter__pane",
				style: S,
				children: t
			})
		]
	});
}
//#endregion
//#region src/lib/VirtualList/VirtualList.tsx
function qe({ items: e, itemHeight: t = 48, height: n = 400, overscan: r = 5, renderItem: a, label: s = "Lista virtual", emptyState: c }) {
	let [d, p] = u(0), m = l(null), h = e.length * t, g = Math.ceil(n / t), _ = Math.max(0, Math.floor(d / t) - r), v = Math.min(e.length, _ + g + r * 2), y = e.slice(_, v), b = i((e) => {
		p(e.target.scrollTop);
	}, []);
	return o(() => {
		m.current && d > h && (m.current.scrollTop = 0, p(0));
	}, [
		e.length,
		h,
		d
	]), e.length === 0 && c ? /* @__PURE__ */ f("div", {
		className: "via-vl via-vl--empty",
		style: { height: n },
		children: c
	}) : /* @__PURE__ */ f("div", {
		ref: m,
		className: "via-vl",
		style: { height: n },
		onScroll: b,
		role: "list",
		"aria-label": s,
		children: /* @__PURE__ */ f("div", {
			className: "via-vl__total",
			style: { height: h },
			children: y.map((e, n) => {
				let r = _ + n;
				return /* @__PURE__ */ f("div", {
					role: "listitem",
					className: "via-vl__item",
					style: {
						position: "absolute",
						top: r * t,
						left: 0,
						right: 0,
						height: t
					},
					children: a(e, r)
				}, r);
			})
		})
	});
}
//#endregion
//#region src/lib/Lightbox/Lightbox.tsx
function Je({ open: e, onClose: t, images: n, index: r = 0, showDownload: a = !1 }) {
	let [s, c] = u(r), m = l(null), [h, g] = u(`${e}:${r}`), _ = `${e}:${r}`;
	_ !== h && (g(_), e && c(r));
	let v = i((e) => {
		c((t) => {
			let r = t + e;
			return r < 0 ? n.length - 1 : r >= n.length ? 0 : r;
		});
	}, [n.length]);
	o(() => {
		if (!e) return;
		let n = (e) => {
			e.key === "Escape" && t(), e.key === "ArrowLeft" && v(-1), e.key === "ArrowRight" && v(1);
		};
		return document.addEventListener("keydown", n), document.body.style.overflow = "hidden", () => {
			document.removeEventListener("keydown", n), document.body.style.overflow = "";
		};
	}, [
		e,
		t,
		v
	]);
	let { onKeyDown: x } = U(e, m);
	if (!e || n.length === 0) return null;
	let S = n[s];
	return /* @__PURE__ */ p("div", {
		ref: m,
		className: "via-lightbox",
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "Visualização de imagem",
		tabIndex: -1,
		onKeyDown: x,
		children: [
			/* @__PURE__ */ f("button", {
				type: "button",
				className: "via-lightbox__close",
				onClick: t,
				"aria-label": "Fechar",
				children: /* @__PURE__ */ f(k, {
					size: 18,
					strokeWidth: 1.8
				})
			}),
			n.length > 1 && /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f("button", {
				type: "button",
				className: "via-lightbox__arrow via-lightbox__arrow--prev",
				onClick: () => v(-1),
				"aria-label": "Imagem anterior",
				children: /* @__PURE__ */ f(y, {
					size: 20,
					strokeWidth: 2
				})
			}), /* @__PURE__ */ f("button", {
				type: "button",
				className: "via-lightbox__arrow via-lightbox__arrow--next",
				onClick: () => v(1),
				"aria-label": "Próxima imagem",
				children: /* @__PURE__ */ f(b, {
					size: 20,
					strokeWidth: 2
				})
			})] }),
			/* @__PURE__ */ f("div", {
				className: "via-lightbox__content",
				onClick: t,
				children: /* @__PURE__ */ f("img", {
					src: S.src,
					alt: S.alt,
					className: "via-lightbox__img",
					onClick: (e) => e.stopPropagation()
				})
			}),
			(S.caption || n.length > 1 || a) && /* @__PURE__ */ p("footer", {
				className: "via-lightbox__foot",
				children: [/* @__PURE__ */ p("div", {
					className: "via-lightbox__caption",
					children: [S.caption && /* @__PURE__ */ f("span", { children: S.caption }), n.length > 1 && /* @__PURE__ */ p("span", {
						className: "via-lightbox__counter",
						children: [
							s + 1,
							" / ",
							n.length
						]
					})]
				}), a && /* @__PURE__ */ p("a", {
					href: S.downloadHref || S.src,
					download: !0,
					className: "via-lightbox__download",
					onClick: (e) => e.stopPropagation(),
					children: [/* @__PURE__ */ f(w, {
						size: 13,
						strokeWidth: 2
					}), "Baixar"]
				})]
			})
		]
	});
}
//#endregion
//#region src/lib/ColorPicker/ColorPicker.tsx
var Ye = [
	{
		hex: "#0A1F3B",
		name: "Navy · marca"
	},
	{
		hex: "#02162A",
		name: "Navy deep"
	},
	{
		hex: "#1E3A5F",
		name: "Blue"
	},
	{
		hex: "#2A4A6E",
		name: "Blue soft"
	},
	{
		hex: "#101828",
		name: "Gray 900"
	},
	{
		hex: "#344054",
		name: "Gray 700"
	},
	{
		hex: "#667085",
		name: "Gray 500"
	},
	{
		hex: "#D0D5DD",
		name: "Gray 300"
	},
	{
		hex: "#F0F2F5",
		name: "Gray 100"
	},
	{
		hex: "#F7F8FA",
		name: "Gray 50"
	},
	{
		hex: "#FFFFFF",
		name: "White"
	},
	{
		hex: "#B85C5C",
		name: "Coral · destrutivo"
	}
];
function Xe({ value: e, onChange: t, palette: n = Ye, label: r, allowCustom: i = !0, disabled: a = !1 }) {
	let [o, s] = u(e || ""), [c, l] = u(e || ""), d = e || "";
	d.toUpperCase() !== c.toUpperCase() && (l(d), s(d));
	let m = n.find((t) => t.hex.toUpperCase() === (e || "").toUpperCase()), h = (e) => {
		a || (s(e), t?.(e));
	}, g = (e) => {
		let n = e.startsWith("#") ? e : `#${e}`;
		n = n.toUpperCase().slice(0, 7), s(n), /^#[0-9A-F]{6}$/.test(n) && t?.(n);
	};
	return /* @__PURE__ */ p("div", {
		className: `via-cp${a ? " is-disabled" : ""}`,
		children: [
			r && /* @__PURE__ */ f("label", {
				className: "via-cp__label",
				children: r
			}),
			/* @__PURE__ */ p("div", {
				className: "via-cp__preview",
				children: [/* @__PURE__ */ f("div", {
					className: "via-cp__swatch",
					style: { background: e || n[0].hex },
					children: /* @__PURE__ */ f(D, {
						size: 14,
						strokeWidth: 2
					})
				}), /* @__PURE__ */ p("div", {
					className: "via-cp__info",
					children: [/* @__PURE__ */ f("p", {
						className: "via-cp__name",
						children: m?.name || "Customizado"
					}), /* @__PURE__ */ p("p", {
						className: "via-cp__hex",
						children: [/* @__PURE__ */ f("span", {
							className: "prefix",
							children: "HEX"
						}), (e || n[0].hex).toUpperCase()]
					})]
				})]
			}),
			/* @__PURE__ */ f("div", {
				className: "via-cp__grid",
				role: "radiogroup",
				"aria-label": "Paleta de cores",
				children: n.map((t) => {
					let n = (e || "").toUpperCase() === t.hex.toUpperCase();
					return /* @__PURE__ */ f("button", {
						type: "button",
						role: "radio",
						"aria-checked": n,
						"aria-label": t.name,
						title: `${t.name} · ${t.hex}`,
						className: `via-cp__cell${n ? " is-selected" : ""}`,
						style: { background: t.hex },
						onClick: () => h(t.hex),
						disabled: a,
						children: n && /* @__PURE__ */ f(_, {
							size: 11,
							strokeWidth: 3,
							style: { color: t.hex.toUpperCase() === "#FFFFFF" || t.hex === "#F7F8FA" || t.hex === "#F0F2F5" || t.hex === "#D0D5DD" ? "#0A1F3B" : "#FFFFFF" }
						})
					}, t.hex);
				})
			}),
			i && /* @__PURE__ */ p("label", {
				className: "via-cp__custom",
				children: [/* @__PURE__ */ f("span", { children: "HEX customizado" }), /* @__PURE__ */ f("input", {
					type: "text",
					value: o,
					placeholder: "#0A1F3B",
					onChange: (e) => g(e.target.value),
					disabled: a,
					maxLength: 7
				})]
			})
		]
	});
}
//#endregion
//#region src/lib/tokens.ts
var Ze = [
	{
		name: "via-accent",
		css: "--via-accent",
		value: "var(--via-navy)",
		category: "color"
	},
	{
		name: "via-accent-deep",
		css: "--via-accent-deep",
		value: "var(--via-navy-deep)",
		category: "color"
	},
	{
		name: "via-accent-light",
		css: "--via-accent-light",
		value: "var(--via-gray-300)",
		category: "color"
	},
	{
		name: "via-accent-soft",
		css: "--via-accent-soft",
		value: "var(--via-gray-300)",
		category: "color"
	},
	{
		name: "via-accent-warm",
		css: "--via-accent-warm",
		value: "var(--via-text-primary)",
		category: "color"
	},
	{
		name: "via-bg",
		css: "--via-bg",
		value: "#0B1220",
		category: "color"
	},
	{
		name: "via-black",
		css: "--via-black",
		value: "#000000",
		category: "color"
	},
	{
		name: "via-blue",
		css: "--via-blue",
		value: "#1E3A5F",
		category: "color"
	},
	{
		name: "via-blue-soft",
		css: "--via-blue-soft",
		value: "#2A4A6E",
		category: "color"
	},
	{
		name: "via-border",
		css: "--via-border",
		value: "rgba(255, 255, 255, 0.18)",
		category: "color"
	},
	{
		name: "via-border-hairline",
		css: "--via-border-hairline",
		value: "rgba(255, 255, 255, 0.10)",
		category: "color"
	},
	{
		name: "via-border-soft",
		css: "--via-border-soft",
		value: "rgba(255, 255, 255, 0.08)",
		category: "color"
	},
	{
		name: "via-chart-1",
		css: "--via-chart-1",
		value: "#6E8CB4",
		category: "color"
	},
	{
		name: "via-chart-2",
		css: "--via-chart-2",
		value: "#8BA3C4",
		category: "color"
	},
	{
		name: "via-chart-3",
		css: "--via-chart-3",
		value: "#A8BAD4",
		category: "color"
	},
	{
		name: "via-chart-4",
		css: "--via-chart-4",
		value: "#C5D1E2",
		category: "color"
	},
	{
		name: "via-chart-5",
		css: "--via-chart-5",
		value: "#E0E7F1",
		category: "color"
	},
	{
		name: "via-chart-ink",
		css: "--via-chart-ink",
		value: "#9FBDE4",
		category: "color"
	},
	{
		name: "via-chart-ink-2",
		css: "--via-chart-ink-2",
		value: "#6E8CB4",
		category: "color"
	},
	{
		name: "via-coral",
		css: "--via-coral",
		value: "#B85C5C",
		category: "color"
	},
	{
		name: "via-coral-dark",
		css: "--via-coral-dark",
		value: "#E89B9B",
		category: "color"
	},
	{
		name: "via-coral-deep",
		css: "--via-coral-deep",
		value: "#A14848",
		category: "color"
	},
	{
		name: "via-danger",
		css: "--via-danger",
		value: "#E58A8A",
		category: "color"
	},
	{
		name: "via-data-1",
		css: "--via-data-1",
		value: "#2E6FC4",
		category: "color"
	},
	{
		name: "via-data-1-dark",
		css: "--via-data-1-dark",
		value: "#5C9BEA",
		category: "color"
	},
	{
		name: "via-data-2",
		css: "--via-data-2",
		value: "#7FB0EE",
		category: "color"
	},
	{
		name: "via-data-2-dark",
		css: "--via-data-2-dark",
		value: "#2E6FC4",
		category: "color"
	},
	{
		name: "via-data-axis",
		css: "--via-data-axis",
		value: "var(--via-navy-20)",
		category: "color"
	},
	{
		name: "via-data-grid",
		css: "--via-data-grid",
		value: "var(--via-navy-08)",
		category: "color"
	},
	{
		name: "via-data-ink",
		css: "--via-data-ink",
		value: "var(--via-text-muted)",
		category: "color"
	},
	{
		name: "via-edge-hi",
		css: "--via-edge-hi",
		value: "rgba(255, 255, 255, 0.08)",
		category: "color"
	},
	{
		name: "via-edge-lo",
		css: "--via-edge-lo",
		value: "rgba(255, 255, 255, 0.05)",
		category: "color"
	},
	{
		name: "via-glass-bar",
		css: "--via-glass-bar",
		value: "rgba(11, 18, 32, 0.55)",
		category: "color"
	},
	{
		name: "via-gray-100",
		css: "--via-gray-100",
		value: "#17213A",
		category: "color"
	},
	{
		name: "via-gray-200",
		css: "--via-gray-200",
		value: "#E4E7EC",
		category: "color"
	},
	{
		name: "via-gray-300",
		css: "--via-gray-300",
		value: "#D0D5DD",
		category: "color"
	},
	{
		name: "via-gray-400",
		css: "--via-gray-400",
		value: "#98A2B3",
		category: "color"
	},
	{
		name: "via-gray-50",
		css: "--via-gray-50",
		value: "#0F1729",
		category: "color"
	},
	{
		name: "via-gray-500",
		css: "--via-gray-500",
		value: "#667085",
		category: "color"
	},
	{
		name: "via-gray-600",
		css: "--via-gray-600",
		value: "#475467",
		category: "color"
	},
	{
		name: "via-gray-700",
		css: "--via-gray-700",
		value: "#344054",
		category: "color"
	},
	{
		name: "via-gray-800",
		css: "--via-gray-800",
		value: "#1D2939",
		category: "color"
	},
	{
		name: "via-gray-900",
		css: "--via-gray-900",
		value: "#101828",
		category: "color"
	},
	{
		name: "via-ink-2",
		css: "--via-ink-2",
		value: "#B4BBC9",
		category: "color"
	},
	{
		name: "via-ink-3",
		css: "--via-ink-3",
		value: "#98A2B3",
		category: "color"
	},
	{
		name: "via-navy",
		css: "--via-navy",
		value: "#0A1F3B",
		category: "color"
	},
	{
		name: "via-navy-02",
		css: "--via-navy-02",
		value: "rgba(255, 255, 255, 0.025)",
		category: "color"
	},
	{
		name: "via-navy-03",
		css: "--via-navy-03",
		value: "rgba(255, 255, 255, 0.035)",
		category: "color"
	},
	{
		name: "via-navy-04",
		css: "--via-navy-04",
		value: "rgba(255, 255, 255, 0.045)",
		category: "color"
	},
	{
		name: "via-navy-05",
		css: "--via-navy-05",
		value: "rgba(255, 255, 255, 0.055)",
		category: "color"
	},
	{
		name: "via-navy-06",
		css: "--via-navy-06",
		value: "rgba(255, 255, 255, 0.07)",
		category: "color"
	},
	{
		name: "via-navy-08",
		css: "--via-navy-08",
		value: "rgba(255, 255, 255, 0.09)",
		category: "color"
	},
	{
		name: "via-navy-10",
		css: "--via-navy-10",
		value: "rgba(255, 255, 255, 0.11)",
		category: "color"
	},
	{
		name: "via-navy-12",
		css: "--via-navy-12",
		value: "rgba(255, 255, 255, 0.13)",
		category: "color"
	},
	{
		name: "via-navy-14",
		css: "--via-navy-14",
		value: "rgba(255, 255, 255, 0.15)",
		category: "color"
	},
	{
		name: "via-navy-16",
		css: "--via-navy-16",
		value: "rgba(255, 255, 255, 0.17)",
		category: "color"
	},
	{
		name: "via-navy-18",
		css: "--via-navy-18",
		value: "rgba(255, 255, 255, 0.19)",
		category: "color"
	},
	{
		name: "via-navy-20",
		css: "--via-navy-20",
		value: "rgba(255, 255, 255, 0.22)",
		category: "color"
	},
	{
		name: "via-navy-22",
		css: "--via-navy-22",
		value: "rgba(255, 255, 255, 0.24)",
		category: "color"
	},
	{
		name: "via-navy-25",
		css: "--via-navy-25",
		value: "rgba(255, 255, 255, 0.28)",
		category: "color"
	},
	{
		name: "via-navy-30",
		css: "--via-navy-30",
		value: "rgba(255, 255, 255, 0.32)",
		category: "color"
	},
	{
		name: "via-navy-40",
		css: "--via-navy-40",
		value: "rgba(255, 255, 255, 0.42)",
		category: "color"
	},
	{
		name: "via-navy-60",
		css: "--via-navy-60",
		value: "rgba(255, 255, 255, 0.55)",
		category: "color"
	},
	{
		name: "via-navy-80",
		css: "--via-navy-80",
		value: "rgba(255, 255, 255, 0.72)",
		category: "color"
	},
	{
		name: "via-navy-darker",
		css: "--via-navy-darker",
		value: "#010B1A",
		category: "color"
	},
	{
		name: "via-navy-deep",
		css: "--via-navy-deep",
		value: "#02162A",
		category: "color"
	},
	{
		name: "via-stage-1",
		css: "--via-stage-1",
		value: "#131C30",
		category: "color"
	},
	{
		name: "via-stage-2",
		css: "--via-stage-2",
		value: "#0B1220",
		category: "color"
	},
	{
		name: "via-stage-soft",
		css: "--via-stage-soft",
		value: "#1B273F",
		category: "color"
	},
	{
		name: "via-success",
		css: "--via-success",
		value: "#1F8A5B",
		category: "color"
	},
	{
		name: "via-surface",
		css: "--via-surface",
		value: "#131C30",
		category: "color"
	},
	{
		name: "via-surface-elev",
		css: "--via-surface-elev",
		value: "#1B273F",
		category: "color"
	},
	{
		name: "via-text",
		css: "--via-text",
		value: "#D0D5DD",
		category: "color"
	},
	{
		name: "via-text-body",
		css: "--via-text-body",
		value: "var(--via-gray-700)",
		category: "color"
	},
	{
		name: "via-text-faint",
		css: "--via-text-faint",
		value: "var(--via-gray-400)",
		category: "color"
	},
	{
		name: "via-text-inverse",
		css: "--via-text-inverse",
		value: "var(--via-navy)",
		category: "color"
	},
	{
		name: "via-text-muted",
		css: "--via-text-muted",
		value: "var(--via-gray-500)",
		category: "color"
	},
	{
		name: "via-text-primary",
		css: "--via-text-primary",
		value: "var(--via-navy)",
		category: "color"
	},
	{
		name: "via-text-soft",
		css: "--via-text-soft",
		value: "var(--via-gray-500)",
		category: "color"
	},
	{
		name: "via-warning",
		css: "--via-warning",
		value: "#0A1F3B",
		category: "color"
	},
	{
		name: "via-white",
		css: "--via-white",
		value: "#FFFFFF",
		category: "color"
	},
	{
		name: "via-display",
		css: "--via-display",
		value: "var(--via-font-display)",
		category: "font"
	},
	{
		name: "via-font",
		css: "--via-font",
		value: "'Geist', 'Inter', system-ui, -apple-system, sans-serif",
		category: "font"
	},
	{
		name: "via-font-display",
		css: "--via-font-display",
		value: "'Geist', 'Inter', system-ui, -apple-system, sans-serif",
		category: "font"
	},
	{
		name: "via-font-mono",
		css: "--via-font-mono",
		value: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
		category: "font"
	},
	{
		name: "via-fs-display",
		css: "--via-fs-display",
		value: "3.5rem",
		category: "font"
	},
	{
		name: "via-mono",
		css: "--via-mono",
		value: "var(--via-font-mono)",
		category: "font"
	},
	{
		name: "via-ease",
		css: "--via-ease",
		value: "cubic-bezier(0.32, 0.08, 0.24, 1)",
		category: "motion"
	},
	{
		name: "via-ease-out",
		css: "--via-ease-out",
		value: "cubic-bezier(0.16, 1, 0.3, 1)",
		category: "motion"
	},
	{
		name: "via-ease-snap",
		css: "--via-ease-snap",
		value: "cubic-bezier(.2, .7, .2, 1)",
		category: "motion"
	},
	{
		name: "via-ease-spring",
		css: "--via-ease-spring",
		value: "cubic-bezier(.34, 1.56, .64, 1)",
		category: "motion"
	},
	{
		name: "via-t",
		css: "--via-t",
		value: "180ms var(--via-ease)",
		category: "motion"
	},
	{
		name: "via-blur-lg",
		css: "--via-blur-lg",
		value: "blur(28px) saturate(180%)",
		category: "other"
	},
	{
		name: "via-blur-md",
		css: "--via-blur-md",
		value: "blur(16px) saturate(160%)",
		category: "other"
	},
	{
		name: "via-blur-sm",
		css: "--via-blur-sm",
		value: "blur(8px)  saturate(140%)",
		category: "other"
	},
	{
		name: "via-blur-xl",
		css: "--via-blur-xl",
		value: "blur(48px) saturate(180%)",
		category: "other"
	},
	{
		name: "via-border-1",
		css: "--via-border-1",
		value: "1px solid var(--via-border)",
		category: "other"
	},
	{
		name: "via-border-fine",
		css: "--via-border-fine",
		value: "0.5px solid var(--via-border-hairline)",
		category: "other"
	},
	{
		name: "via-border-strong",
		css: "--via-border-strong",
		value: "1px solid var(--via-navy-40)",
		category: "other"
	},
	{
		name: "via-container",
		css: "--via-container",
		value: "1280px",
		category: "other"
	},
	{
		name: "via-content",
		css: "--via-content",
		value: "760px",
		category: "other"
	},
	{
		name: "via-dur",
		css: "--via-dur",
		value: "220ms",
		category: "other"
	},
	{
		name: "via-fs-body",
		css: "--via-fs-body",
		value: "1rem",
		category: "other"
	},
	{
		name: "via-fs-caption",
		css: "--via-fs-caption",
		value: "0.8125rem",
		category: "other"
	},
	{
		name: "via-fs-h1",
		css: "--via-fs-h1",
		value: "2.5rem",
		category: "other"
	},
	{
		name: "via-fs-h2",
		css: "--via-fs-h2",
		value: "2rem",
		category: "other"
	},
	{
		name: "via-fs-h3",
		css: "--via-fs-h3",
		value: "1.5rem",
		category: "other"
	},
	{
		name: "via-fs-h4",
		css: "--via-fs-h4",
		value: "1.125rem",
		category: "other"
	},
	{
		name: "via-fs-hero",
		css: "--via-fs-hero",
		value: "5rem",
		category: "other"
	},
	{
		name: "via-fs-label",
		css: "--via-fs-label",
		value: "0.6875rem",
		category: "other"
	},
	{
		name: "via-fs-micro",
		css: "--via-fs-micro",
		value: "0.625rem",
		category: "other"
	},
	{
		name: "via-fs-sm",
		css: "--via-fs-sm",
		value: "0.875rem",
		category: "other"
	},
	{
		name: "via-fs-xs",
		css: "--via-fs-xs",
		value: "0.75rem",
		category: "other"
	},
	{
		name: "via-fw-black",
		css: "--via-fw-black",
		value: "900",
		category: "other"
	},
	{
		name: "via-fw-bold",
		css: "--via-fw-bold",
		value: "700",
		category: "other"
	},
	{
		name: "via-fw-light",
		css: "--via-fw-light",
		value: "300",
		category: "other"
	},
	{
		name: "via-fw-medium",
		css: "--via-fw-medium",
		value: "500",
		category: "other"
	},
	{
		name: "via-fw-regular",
		css: "--via-fw-regular",
		value: "400",
		category: "other"
	},
	{
		name: "via-fw-semibold",
		css: "--via-fw-semibold",
		value: "600",
		category: "other"
	},
	{
		name: "via-glass-blur",
		css: "--via-glass-blur",
		value: "blur(24px) saturate(175%)",
		category: "other"
	},
	{
		name: "via-glass-blur-bar",
		css: "--via-glass-blur-bar",
		value: "blur(26px) saturate(185%)",
		category: "other"
	},
	{
		name: "via-glass-card",
		css: "--via-glass-card",
		value: "linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.05) 10%, rgba(255, 255, 255, 0.022) 100%)",
		category: "other"
	},
	{
		name: "via-glass-card-2",
		css: "--via-glass-card-2",
		value: "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.018))",
		category: "other"
	},
	{
		name: "via-glass-ring",
		css: "--via-glass-ring",
		value: "1px solid var(--via-border-soft)",
		category: "other"
	},
	{
		name: "via-glass-sheen",
		css: "--via-glass-sheen",
		value: "linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent)",
		category: "other"
	},
	{
		name: "via-glow-navy",
		css: "--via-glow-navy",
		value: "0 0 0 1px rgba(10,31,59,0.05),\n    0 8px 24px rgba(10,31,59,0.20),\n    0 16px 48px rgba(10,31,59,0.14)",
		category: "other"
	},
	{
		name: "via-glow-navy-strong",
		css: "--via-glow-navy-strong",
		value: "0 0 0 1px rgba(10,31,59,0.10),\n    0 16px 48px rgba(10,31,59,0.30),\n    0 32px 80px rgba(10,31,59,0.20)",
		category: "other"
	},
	{
		name: "via-lh-loose",
		css: "--via-lh-loose",
		value: "1.65",
		category: "other"
	},
	{
		name: "via-lh-normal",
		css: "--via-lh-normal",
		value: "1.5",
		category: "other"
	},
	{
		name: "via-lh-snug",
		css: "--via-lh-snug",
		value: "1.2",
		category: "other"
	},
	{
		name: "via-lh-tight",
		css: "--via-lh-tight",
		value: "1.02",
		category: "other"
	},
	{
		name: "via-ls-brand",
		css: "--via-ls-brand",
		value: "0.32em",
		category: "other"
	},
	{
		name: "via-ls-label",
		css: "--via-ls-label",
		value: "0.18em",
		category: "other"
	},
	{
		name: "via-ls-mark",
		css: "--via-ls-mark",
		value: "0.22em",
		category: "other"
	},
	{
		name: "via-ls-tight",
		css: "--via-ls-tight",
		value: "-0.015em",
		category: "other"
	},
	{
		name: "via-ls-tighter",
		css: "--via-ls-tighter",
		value: "-0.025em",
		category: "other"
	},
	{
		name: "via-ls-wide",
		css: "--via-ls-wide",
		value: "0.08em",
		category: "other"
	},
	{
		name: "via-narrow",
		css: "--via-narrow",
		value: "560px",
		category: "other"
	},
	{
		name: "via-surface-onnavy",
		css: "--via-surface-onnavy",
		value: "linear-gradient(180deg, #FFFFFF 0%, #F5F7FA 100%)",
		category: "other"
	},
	{
		name: "via-t-fast",
		css: "--via-t-fast",
		value: "120ms var(--via-ease)",
		category: "other"
	},
	{
		name: "via-t-slow",
		css: "--via-t-slow",
		value: "360ms var(--via-ease)",
		category: "other"
	},
	{
		name: "via-radius-2xl",
		css: "--via-radius-2xl",
		value: "40px",
		category: "radius"
	},
	{
		name: "via-radius-lg",
		css: "--via-radius-lg",
		value: "20px",
		category: "radius"
	},
	{
		name: "via-radius-md",
		css: "--via-radius-md",
		value: "14px",
		category: "radius"
	},
	{
		name: "via-radius-pill",
		css: "--via-radius-pill",
		value: "999px",
		category: "radius"
	},
	{
		name: "via-radius-sm",
		css: "--via-radius-sm",
		value: "10px",
		category: "radius"
	},
	{
		name: "via-radius-xl",
		css: "--via-radius-xl",
		value: "28px",
		category: "radius"
	},
	{
		name: "via-radius-xs",
		css: "--via-radius-xs",
		value: "6px",
		category: "radius"
	},
	{
		name: "via-glass-shadow",
		css: "--via-glass-shadow",
		value: "inset 0 1px 0 var(--via-edge-hi),\n    0 12px 32px -14px var(--via-navy-14),\n    0 2px 8px -4px var(--via-navy-06)",
		category: "shadow"
	},
	{
		name: "via-glass-shadow-lift",
		css: "--via-glass-shadow-lift",
		value: "inset 0 1px 0 var(--via-edge-hi),\n    0 24px 56px -20px var(--via-navy-20),\n    0 4px 12px -6px var(--via-navy-08)",
		category: "shadow"
	},
	{
		name: "via-shadow-focus",
		css: "--via-shadow-focus",
		value: "0 0 0 3px rgba(10,31,59,0.15)",
		category: "shadow"
	},
	{
		name: "via-shadow-glass-dark",
		css: "--via-shadow-glass-dark",
		value: "inset 0 1px 0 rgba(255,255,255,0.25),\n    inset 0 -1px 0 rgba(255,255,255,0.06),\n    0 16px 40px rgba(0,0,0,0.30),\n    0 4px 12px rgba(0,0,0,0.15)",
		category: "shadow"
	},
	{
		name: "via-shadow-glass-light",
		css: "--via-shadow-glass-light",
		value: "inset 0 1px 0 rgba(255,255,255,0.95),\n    inset 0 -1px 0 rgba(255,255,255,0.30),\n    0 12px 32px rgba(10,31,59,0.08),\n    0 2px 8px rgba(10,31,59,0.04)",
		category: "shadow"
	},
	{
		name: "via-shadow-ink-03",
		css: "--via-shadow-ink-03",
		value: "rgba(10, 31, 59, 0.03)",
		category: "shadow"
	},
	{
		name: "via-shadow-ink-06",
		css: "--via-shadow-ink-06",
		value: "rgba(10, 31, 59, 0.06)",
		category: "shadow"
	},
	{
		name: "via-shadow-ink-10",
		css: "--via-shadow-ink-10",
		value: "rgba(10, 31, 59, 0.10)",
		category: "shadow"
	},
	{
		name: "via-shadow-ink-14",
		css: "--via-shadow-ink-14",
		value: "rgba(10, 31, 59, 0.14)",
		category: "shadow"
	},
	{
		name: "via-shadow-ink-20",
		css: "--via-shadow-ink-20",
		value: "rgba(10, 31, 59, 0.20)",
		category: "shadow"
	},
	{
		name: "via-shadow-ink-30",
		css: "--via-shadow-ink-30",
		value: "rgba(10, 31, 59, 0.30)",
		category: "shadow"
	},
	{
		name: "via-shadow-ink-40",
		css: "--via-shadow-ink-40",
		value: "rgba(10, 31, 59, 0.40)",
		category: "shadow"
	},
	{
		name: "via-shadow-ink-60",
		css: "--via-shadow-ink-60",
		value: "rgba(10, 31, 59, 0.60)",
		category: "shadow"
	},
	{
		name: "via-shadow-lg",
		css: "--via-shadow-lg",
		value: "0 16px 40px rgba(10,31,59,0.10), 0 2px 8px rgba(10,31,59,0.05)",
		category: "shadow"
	},
	{
		name: "via-shadow-md",
		css: "--via-shadow-md",
		value: "0 6px 18px rgba(10,31,59,0.07), 0 1px 3px rgba(10,31,59,0.04)",
		category: "shadow"
	},
	{
		name: "via-shadow-sm",
		css: "--via-shadow-sm",
		value: "0 2px 6px rgba(10,31,59,0.05), 0 1px 2px rgba(10,31,59,0.03)",
		category: "shadow"
	},
	{
		name: "via-shadow-xl",
		css: "--via-shadow-xl",
		value: "0 32px 80px rgba(10,31,59,0.14), 0 4px 16px rgba(10,31,59,0.06)",
		category: "shadow"
	},
	{
		name: "via-shadow-xs",
		css: "--via-shadow-xs",
		value: "0 1px 2px rgba(10,31,59,0.04)",
		category: "shadow"
	},
	{
		name: "via-space-1",
		css: "--via-space-1",
		value: "4px",
		category: "spacing"
	},
	{
		name: "via-space-10",
		css: "--via-space-10",
		value: "40px",
		category: "spacing"
	},
	{
		name: "via-space-12",
		css: "--via-space-12",
		value: "48px",
		category: "spacing"
	},
	{
		name: "via-space-14",
		css: "--via-space-14",
		value: "56px",
		category: "spacing"
	},
	{
		name: "via-space-16",
		css: "--via-space-16",
		value: "64px",
		category: "spacing"
	},
	{
		name: "via-space-2",
		css: "--via-space-2",
		value: "8px",
		category: "spacing"
	},
	{
		name: "via-space-20",
		css: "--via-space-20",
		value: "80px",
		category: "spacing"
	},
	{
		name: "via-space-24",
		css: "--via-space-24",
		value: "96px",
		category: "spacing"
	},
	{
		name: "via-space-3",
		css: "--via-space-3",
		value: "12px",
		category: "spacing"
	},
	{
		name: "via-space-32",
		css: "--via-space-32",
		value: "128px",
		category: "spacing"
	},
	{
		name: "via-space-4",
		css: "--via-space-4",
		value: "16px",
		category: "spacing"
	},
	{
		name: "via-space-5",
		css: "--via-space-5",
		value: "20px",
		category: "spacing"
	},
	{
		name: "via-space-6",
		css: "--via-space-6",
		value: "24px",
		category: "spacing"
	},
	{
		name: "via-space-7",
		css: "--via-space-7",
		value: "28px",
		category: "spacing"
	},
	{
		name: "via-space-8",
		css: "--via-space-8",
		value: "32px",
		category: "spacing"
	},
	{
		name: "via-space-9",
		css: "--via-space-9",
		value: "36px",
		category: "spacing"
	},
	{
		name: "via-bg-2",
		css: "--via-bg-2",
		value: "#131C30",
		category: "surface"
	},
	{
		name: "via-bg-3",
		css: "--via-bg-3",
		value: "#1B273F",
		category: "surface"
	},
	{
		name: "via-bg-soft",
		css: "--via-bg-soft",
		value: "rgba(255, 255, 255, 0.04)",
		category: "surface"
	},
	{
		name: "via-mesh-light",
		css: "--via-mesh-light",
		value: "radial-gradient(ellipse 60% 70% at 12% 0%,  rgba(30,58,95,0.28) 0%,  transparent 55%),\n    radial-gradient(ellipse 50% 60% at 95% 8%,  rgba(46,76,118,0.22) 0%, transparent 55%),\n    radial-gradient(ellipse 70% 80% at 100% 100%, rgba(10,31,59,0.30) 0%, transparent 55%),\n    radial-gradient(ellipse 50% 60% at 5% 100%, rgba(30,58,95,0.18) 0%, transparent 55%),\n    linear-gradient(135deg, #CCD4DD 0%, #A7B2C0 100%)",
		category: "surface"
	},
	{
		name: "via-mesh-navy",
		css: "--via-mesh-navy",
		value: "radial-gradient(ellipse 60% 70% at 12% 0%,  rgba(46,76,118,0.55) 0%, transparent 60%),\n    radial-gradient(ellipse 50% 60% at 95% 8%,  rgba(30,58,95,0.50)  0%, transparent 60%),\n    radial-gradient(ellipse 70% 80% at 100% 100%, rgba(2,22,42,0.85) 0%, transparent 55%),\n    radial-gradient(ellipse 50% 60% at 5% 100%, rgba(46,76,118,0.40) 0%, transparent 55%),\n    linear-gradient(135deg, #0A1F3B 0%, #02162A 100%)",
		category: "surface"
	},
	{
		name: "via-noise",
		css: "--via-noise",
		value: "url(\"data:image/svg+xml",
		category: "surface"
	}
], Qe = Object.freeze(Ze.reduce((e, t) => (e[t.name] = t.value, e), {}));
function $e(e) {
	return `var(--${e})`;
}
//#endregion
//#region src/lib/theming/theming-core.ts
var et = t(null), Z = "via-theme";
function tt() {
	if (typeof window > "u") return "light";
	let e = window.localStorage.getItem(Z);
	return e === "light" || e === "dark" || e === "system" ? e : "light";
}
function Q() {
	return typeof window > "u" ? "light" : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function $(e) {
	typeof document > "u" || (document.documentElement.dataset.theme = e);
}
function nt() {
	let e = a(et), [t, n] = u(() => typeof document > "u" ? "light" : document.documentElement.dataset.theme || Q());
	if (o(() => {
		if (e || typeof window > "u") return;
		let t = new MutationObserver(() => {
			n(document.documentElement.dataset.theme || "light");
		});
		return t.observe(document.documentElement, {
			attributes: !0,
			attributeFilter: ["data-theme"]
		}), () => t.disconnect();
	}, [e]), e) return e;
	let r = (e) => {
		$(e === "system" ? Q() : e);
		try {
			window.localStorage.setItem(Z, e);
		} catch {}
	};
	return {
		theme: t,
		mode: t,
		setMode: r,
		toggle: () => r(t === "dark" ? "light" : "dark")
	};
}
function rt(e, t = {}) {
	let { selector: n = ":root", scope: r } = t;
	return `${r ? `${n}[data-theme="${r}"]` : n} {\n${Object.entries(e).filter(([e]) => e.startsWith("--via-")).map(([e, t]) => `  ${e}: ${t};`).join("\n")}\n}`;
}
//#endregion
//#region src/lib/theming/theming.tsx
function it({ defaultMode: e, persist: t = !0, children: n }) {
	let [r, a] = u(() => e || (t ? tt() : "light")), [s, l] = u(() => Q());
	o(() => {
		if (typeof window > "u") return;
		let e = window.matchMedia("(prefers-color-scheme: dark)"), t = (e) => l(e.matches ? "dark" : "light");
		return e.addEventListener("change", t), () => e.removeEventListener("change", t);
	}, []);
	let d = r === "system" ? s : r;
	o(() => {
		$(d);
	}, [d]);
	let p = i((e) => {
		if (a(e), t && typeof window < "u") try {
			window.localStorage.setItem(Z, e);
		} catch {}
	}, [t]), m = i(() => {
		p(d === "dark" ? "light" : "dark");
	}, [p, d]), h = c(() => ({
		theme: d,
		mode: r,
		setMode: p,
		toggle: m
	}), [
		d,
		r,
		p,
		m
	]);
	return /* @__PURE__ */ f(et.Provider, {
		value: h,
		children: n
	});
}
//#endregion
export { pe as Accordion, Ae as Alert, F as Avatar, ue as Breadcrumb, A as Button, Le as Calendar, M as Card, Re as Carousel, ne as Checkbox, Xe as ColorPicker, _e as Combobox, be as Command, Ve as ContextMenu, je as DataTable, De as DatePicker, We as DateRangePicker, se as Drawer, ve as DropdownMenu, ge as EmptyState, Me as HoverCard, I as Icon, N as Input, Je as Lightbox, W as Modal, He as MultiSelect, Ne as OTPInput, de as Pagination, j as Pill, ye as Popover, ae as Progress, re as RadioGroup, ie as Select, Be as Sheet, le as Skeleton, Oe as Slider, ce as Spinner, Ke as Splitter, me as Stepper, te as Switch, ee as Tabs, Pe as TagInput, it as ThemeProvider, ze as TimePicker, z as ToastStack, V as Tooltip, Ge as TreeView, qe as VirtualList, $ as applyTheme, rt as createThemeOverride, $e as cssVar, Qe as tokens, Ze as tokensList, nt as useTheme, B as useToasts };

//# sourceMappingURL=index.js.map