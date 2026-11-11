"""Hook PreToolUse: chặn các lệnh làm KHOÁ BÍ MẬT hiện ra màn hình / khung chat.

Luật "dùng chìa, không nhìn chìa":
  - CHẶN: đọc/hiện tệp khoá (cat, type, Get-Content, head, grep thường...), in biến tên có KEY/TOKEN/SECRET/PASSWORD,
          printenv, env/set/export -p trần, Get-ChildItem env:, curl -v khi có khoá, git add tệp khoá,
          công cụ Read/Grep vào tệp khoá.
  - CHO QUA: nạp khoá vào lệnh (source .env; . .env), grep -c / -q / -l (chỉ đếm/kiểm), liệt kê tên tệp (ls, find).
Thoát mã 2 = chặn (Claude Code đọc lý do ở stderr). Lỗi bất ngờ trong hook = cho qua (không làm hỏng việc).
Thử: python <skill>/scripts/thu-hook.py <đường dẫn hook này>
"""
import json
import re
import shlex
import sys

SECRET_FILE = re.compile(
    r"""(?ix)(?:^|[\s"'=/\\:(<@])(
        \.env(?:\.(?!example\b|sample\b|template\b)[\w.-]+)?   # .env, .env.local (trừ .env.example)
      | [\w-]+\.env
      | \.dev\.vars
      | [\w.-]*\.pem | [\w.-]*\.key | [\w.-]*\.p12 | [\w.-]*\.pfx
      | client_secret[\w.-]*
      | [\w.-]*credentials?[\w.-]*\.json
      | [\w.-]*token[\w.-]*\.json
      | id_rsa | id_ed25519 | id_ecdsa
      | \.git-credentials | \.netrc | \.npmrc | \.pypirc
      | secrets?(?:\.[\w.-]+)?
    )(?=$|[\s"'|;&)>,\]])""")

READERS = {
    "cat", "type", "more", "less", "head", "tail", "bat", "nl", "tac", "od", "xxd", "hexdump", "strings",
    "base64", "get-content", "gc", "sed", "awk", "gawk", "cut", "sort", "uniq", "diff", "cmp", "fc", "paste",
    "column", "jq", "yq", "iconv", "openssl", "certutil", "notepad", "code", "vim", "vi", "nano",
    "python", "python3", "py", "node", "ruby", "perl", "php", "pwsh", "powershell",
    "cp", "copy", "copy-item", "mv", "move", "move-item", "scp", "rsync", "curl", "wget", "invoke-webrequest",
    "invoke-restmethod", "iwr", "irm", "clip", "set-clipboard", "tee", "out-file",
}
SEARCHERS = {"grep", "egrep", "fgrep", "rg", "findstr", "select-string", "sls", "ag", "ack"}
SEARCH_SAFE_FLAG = re.compile(r"(?:^|\s)(?:-[a-zA-Z]*[cqlL][a-zA-Z]*|--count|--quiet|--silent|--files-with(?:out)?-matches?|/[cCmM]\b|-Quiet|-List)(?=\s|$)")
LOADERS = {"source", "."}

SECRET_NAME = r"[\w]*(?:KEY|TOKEN|SECRET|PASS(?:WORD|WD)?|PWD|CREDENTIAL|AUTH)[\w]*"
PRINT_VAR = re.compile(
    r"(?i)\b(?:echo|printf|print|write-host|write-output|write-error|console\.log|say|out-host)\b[^|;&\n]*"
    r"(?:\$\{?(?:env:)?" + SECRET_NAME + r"|%" + SECRET_NAME + r"%|os\.environ|getenv\(|process\.env)")
PS_BARE_ENV = re.compile(r"(?i)^\s*\(?\s*\$\{?env:" + SECRET_NAME + r"\}?\s*\)?\s*$")
PY_PRINT_ENV = re.compile(r"(?i)print\s*\(\s*(?:os\.environ|os\.getenv|dict\(os\.environ)")
DUMP_ENV = re.compile(
    r"(?i)^\s*(?:printenv\b.*|env\s*$|set\s*$|export\s+-p\b.*|export\s*$|declare\s+-[a-z]*[px][a-z]*\b.*|typeset\s+-[px].*"
    r"|(?:get-childitem|gci|dir|ls|get-item|gi)\s+(?:-path\s+)?env:.*|\[environment\]::getenvironmentvariables.*)")
CURL_VERBOSE = re.compile(r"(?i)(?:^|\s)(?:-v|-vv+|--verbose|--trace(?:-ascii)?\b|-i|--include)(?=\s|$)")
HAS_SECRET_REF = re.compile(r"(?i)\$\{?(?:env:)?" + SECRET_NAME + r"|authorization|x-api-key|[?&](?:key|token|access_token)=")


def block(reason):
    msg = ("CHAN LO KHOA: " + reason + "\n"
           "Luat 'dung chia, khong nhin chia': khong in gia tri khoa. Kiem tra co/khong thi dem (grep -c), "
           "dung khoa thi nap trong cung lenh: (set -a; source .env; set +a; lenh-dung-khoa).")
    sys.stderr.buffer.write(msg.encode("utf-8"))
    sys.exit(2)


def split_segments(cmd):
    """Tach lenh theo | ; & xuong dong — bo qua cac ky tu nam trong dau nhay."""
    out, cur, q = [], [], None
    for c in cmd:
        if q:
            cur.append(c)
            if c == q:
                q = None
        elif c in "\"'":
            q = c
            cur.append(c)
        elif c in "|;&\n":
            out.append("".join(cur))
            cur = []
        else:
            cur.append(c)
    out.append("".join(cur))
    return [s.strip() for s in out if s.strip()]


def search_files(verb, rest):
    """Voi lenh tim chu: bo MAU TIM, chi giu ten tep duoc doc."""
    try:
        args = shlex.split(rest, posix=True)
    except ValueError:
        return rest
    files, pattern_seen, skip_next = [], False, False
    for a in args:
        if skip_next:
            skip_next = False
            continue
        al = a.lower()
        if verb in ("select-string", "sls"):
            if al == "-pattern":
                skip_next = True
            elif al not in ("-path", "-literalpath"):
                files.append(a)
            continue
        if al in ("-e", "--regexp", "-f", "--file"):
            skip_next = True
            pattern_seen = True
            continue
        if a.startswith("-") or (verb == "findstr" and a.startswith("/")):
            continue
        if not pattern_seen:
            pattern_seen = True
            continue
        files.append(a)
    return " ".join(files)


def first_word(seg):
    seg = seg.lstrip("({ \t")
    words = seg.split()
    i = 0
    while i < len(words) and (re.match(r"^\w+=", words[i]) or words[i] in ("sudo", "command", "exec", "time", "nohup", "&")):
        i += 1
    if i >= len(words):
        return "", ""
    w = words[i].strip("\"'").replace("\\", "/").rsplit("/", 1)[-1].lower()
    if w.endswith(".exe"):
        w = w[:-4]
    return w, " ".join(words[i + 1:])


def check_command(cmd):
    for seg in split_segments(cmd):
        verb, rest = first_word(seg)
        if DUMP_ENV.match(seg.lstrip("( ")):
            block("lenh nay in toan bo bien moi truong (co the chua khoa): " + verb)
        if PRINT_VAR.search(seg) or PS_BARE_ENV.match(seg) or PY_PRINT_ENV.search(seg):
            block("lenh nay in gia tri bien co ten giong khoa (KEY/TOKEN/SECRET/PASSWORD)")
        if verb == "curl" and CURL_VERBOSE.search(rest) and HAS_SECRET_REF.search(seg):
            block("curl -v/--trace/-i se in ca header chua khoa")
        if not SECRET_FILE.search(seg):
            continue
        if verb in LOADERS:
            continue  # nap khoa vao lenh: cho qua
        if verb in SEARCHERS:
            if SEARCH_SAFE_FLAG.search(rest):
                continue  # chi dem / kiem co-khong / liet ke ten tep
            if not SECRET_FILE.search(" " + search_files(verb, rest)):
                continue  # chu ".env" chi nam trong MAU TIM (vd loc ket qua git ls-files), khong doc tep khoa
            block("tim chu trong tep khoa se in ra gia tri; dung grep -c hoac grep -q")
        if verb == "git" and re.match(r"(?i)\s*(add|show|diff|cat-file|log\s+-p)\b", rest):
            block("khong dua tep khoa vao git / khong hien noi dung tep khoa tu git")
        if verb in READERS:
            block("lenh '" + verb + "' se doc/hien hoac sao chep tep khoa")


def main():
    try:
        data = json.loads(sys.stdin.buffer.read().decode("utf-8") or "{}")
    except Exception:
        return
    tool = data.get("tool_name", "")
    inp = data.get("tool_input") or {}
    if tool in ("Bash", "PowerShell"):
        check_command(str(inp.get("command", "")))
    elif tool == "Read":
        if SECRET_FILE.search(" " + str(inp.get("file_path", "")).replace("\\", "/")):
            block("cong cu Read se hien noi dung tep khoa")
    elif tool == "Grep":
        target = " " + str(inp.get("path", "")).replace("\\", "/") + " " + str(inp.get("glob", ""))
        if SECRET_FILE.search(target) and inp.get("output_mode") not in ("count", "files_with_matches"):
            block("Grep vao tep khoa se hien gia tri; dung output_mode count hoac files_with_matches")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        pass  # loi bat ngo trong hook: cho qua, khong chan viec
