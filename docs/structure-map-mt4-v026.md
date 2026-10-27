# MT4 0.2.6 Chinese display maintenance

Customer 0.2.5 EX4 was reproduced in isolated MT4: Unicode strings are intact before ObjectSetString, but OBJPROP_TEXT reads back question marks. Source re-encoding alone did not fix it. This revision embeds a small Noto Sans SC glyph atlas and composes Chinese text bitmap labels without terminal ANSI text or installed-font dependencies. English text mode remains available. Generic English tooltips replace Chinese tooltips on bitmap labels.

Final customer EX4 compiles with zero errors/warnings and loads in isolated no-account MT4. All 11 panel bitmap resources contain visible pixels and were exported for Chinese visual inspection. This is a no-live-data display acceptance, not a full market-history or profitability audit. Core signal/state code is byte-identical; email logic is unchanged. MT5 remains 0.2.5. The private ZIP includes the EX4, installation notes, changelog, checksums and SIL OFL license, not indicator sources.
