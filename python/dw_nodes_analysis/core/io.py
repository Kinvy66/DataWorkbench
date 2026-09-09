# dw:adapted — chardet replaced with charset-normalizer (already a host dependency).
# -*- coding: utf-8 -*-
"""
数据 I/O 模块（纯函数部分）

提供文件编码检测、文件过滤器列表、通用数据读取和导出函数。
不依赖 Qt 或 DA 应用框架。
"""

from typing import List

import pandas as pd

# Restrict detection to encodings this product actually imports. Unbounded
# charset-normalizer often labels short GB18030 CSVs as cp949/Korean.
_IMPORT_CODEPAGES = ("utf_8", "utf_8_sig", "gb18030", "gbk", "gb2312", "big5")
_KR_MISDETECT = frozenset({"cp949", "euc_kr", "euc-kr", "iso2022_kr", "iso-2022-kr", "iso_2022_kr"})
_UTF8_BOM = b"\xef\xbb\xbf"


def detect_encoding(file_path: str, chunk_size: int = 1024) -> str:
    """
    检测文件的编码，适用于大文件和小文件。

    :param file_path: 文件路径
    :param chunk_size: 每次读取的字节数，默认 1024（保留签名兼容；实现读前 64KiB）
    :return: 检测到的编码，检测失败时返回 'utf-8'
    """
    del chunk_size
    with open(file_path, "rb") as handle:
        sample = handle.read(65536)
    if sample.startswith(_UTF8_BOM):
        return "utf-8-sig"
    try:
        sample.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass
    try:
        from charset_normalizer import from_bytes

        best = from_bytes(sample, cp_isolation=list(_IMPORT_CODEPAGES)).best()
        if best and best.encoding:
            encoding = str(best.encoding)
            if encoding.lower().replace("-", "_") in _KR_MISDETECT:
                sample.decode("gb18030")
                return "gb18030"
            return encoding
    except UnicodeDecodeError:
        pass
    except Exception:
        pass
    try:
        sample.decode("gb18030")
        return "gb18030"
    except UnicodeDecodeError:
        return "utf-8"


def support_file_filters_list() -> List[str]:
    """
    返回支持导入的文件后缀列表，可用于 QFileDialog 的文件过滤器。
    """
    return [
        "Csv Files (*.csv)",
        "Excel Files (*.xlsx)",
        "Parquet Files(*.parquet)",
        "Feather Files(*.feather)",
        "Python Files (*.pkl)",
        "HTML Files (*.html)",
        "Json Files (*.json)",
        "All Files(*.*)",
    ]


def support_file_filters() -> str:
    """
    返回支持导入的文件过滤器字符串（;; 拼接）。
    """
    return ";;".join(support_file_filters_list())


def read_data(
    file_path: str,
    file_type: str = "csv",
    encoding: str = "utf-8",
    separator: str = ",",
    sheet_name: str = "0",
) -> pd.DataFrame:
    """
    通用数据文件读取函数，支持 CSV、Excel、JSON、Parquet。

    :param file_path: 文件路径
    :param file_type: 文件格式（csv/excel/json/parquet）
    :param encoding: 文件编码（仅 CSV 有效）
    :param separator: 字段分隔符（仅 CSV 有效）
    :param sheet_name: Excel 工作表名称或索引
    :return: 读取的 DataFrame
    """
    ft = file_type.strip().lower()
    if ft == "csv":
        return pd.read_csv(file_path, encoding=encoding, sep=separator)
    if ft in ("excel", "xlsx"):
        sheet: object = sheet_name
        if isinstance(sheet_name, str) and sheet_name.isdigit():
            sheet = int(sheet_name)
        return pd.read_excel(file_path, sheet_name=sheet)
    if ft == "json":
        return pd.read_json(file_path)
    if ft == "parquet":
        return pd.read_parquet(file_path)
    raise ValueError(f"Unsupported file format: {file_type}")


def export_data(df: pd.DataFrame, file_path: str, file_type: str = "csv"):
    """
    导出 DataFrame 为指定格式文件。

    :param df: 要导出的 DataFrame
    :param file_path: 导出文件路径
    :param file_type: 文件类型（csv/xlsx/parquet/feather/pkl/html/json）
    """
    ft = file_type.strip().lower()
    if ft == "csv":
        df.to_csv(file_path, index=False)
    elif ft in ("xlsx", "excel"):
        df.to_excel(file_path, index=False)
    elif ft == "parquet":
        df.to_parquet(file_path, index=False)
    elif ft == "feather":
        df.reset_index().to_feather(file_path)
    elif ft in ("pickle", "pkl"):
        df.to_pickle(file_path)
    elif ft == "html":
        df.to_html(file_path, index=False)
    elif ft == "json":
        df.to_json(file_path, force_ascii=False)
    else:
        raise ValueError(f"Unsupported export format: {file_type}")
