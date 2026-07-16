# Butterfly local patches

Apply these patches from the Hexo source repository root after replacing or
upgrading `themes/butterfly`.

Initialize the theme after a fresh clone:

```bash
git submodule update --init --recursive
```

## MathJax display delimiters

`butterfly-mathjax-display-math.patch` explicitly enables `$$...$$` and
`\\[...\\]` display-math delimiters. It was verified against Butterfly 5.5.3
and 5.5.5.

```bash
git apply --ignore-space-change --check patches/butterfly-mathjax-display-math.patch
git apply --ignore-space-change patches/butterfly-mathjax-display-math.patch
```

If `git apply --check` fails, inspect the upstream MathJax template before
updating the patch. Do not force-apply it.
