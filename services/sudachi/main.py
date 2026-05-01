"""
Sudachi FastAPI sidecar.

Deployed as its own Render web service, called by Kotoba's /api/tokenize and
/api/ingest. Returns one Token row per Sudachi morpheme.
"""

from fastapi import FastAPI
from pydantic import BaseModel
from sudachipy import dictionary, tokenizer

app = FastAPI()
_tok = dictionary.Dictionary(dict_type="full").create()
MODE = tokenizer.Tokenizer.SplitMode.C  # longest matching unit


class TokenizeIn(BaseModel):
    text: str


class Token(BaseModel):
    surface: str
    lemma: str
    reading: str | None = None
    pos: str | None = None
    jmdict_id: int | None = None


class TokenizeOut(BaseModel):
    tokens: list[Token]


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/tokenize", response_model=TokenizeOut)
def tokenize(body: TokenizeIn):
    tokens: list[Token] = []
    for m in _tok.tokenize(body.text, MODE):
        reading_kata = m.reading_form() or None
        reading = _kata_to_hira(reading_kata) if reading_kata else None
        pos = ",".join(p for p in m.part_of_speech() if p and p != "*")
        tokens.append(
            Token(
                surface=m.surface(),
                lemma=m.dictionary_form(),
                reading=reading,
                pos=pos or None,
            )
        )
    return TokenizeOut(tokens=tokens)


def _kata_to_hira(s: str) -> str:
    out = []
    for ch in s:
        c = ord(ch)
        if 0x30A1 <= c <= 0x30F6:
            out.append(chr(c - 0x60))
        else:
            out.append(ch)
    return "".join(out)
