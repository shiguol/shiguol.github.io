title: Debug with LLDB
date: 2025-05-19 00:01:29
categories: Programming
tags: 
- Unix
- LLDB

---

First, compile codes with DSYM:

```
g++ -g test.cpp -o test
```

then, launch with LLDB Debugger:

```
lldb test
```

print codes:

```
list(l) numbers
```

set breakpoint:

```
breakpoint set --file test.cpp --line 13
```

enable breakpoint:

```
breakpoint enable 1
```

run program:

```
run
```

debug step-in:

```
n
```

continue to end:

```
c
```

