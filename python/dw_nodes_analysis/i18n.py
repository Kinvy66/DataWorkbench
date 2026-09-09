# dw:adapted — identity `_` until gettext; must run before @NodeDef modules import.


def _(message: str) -> str:
    return message


def setup_i18n() -> None:
    import builtins

    builtins._ = _  # type: ignore[attr-defined]
