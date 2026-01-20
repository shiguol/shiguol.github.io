title: tar command
date: 2023-06-11 14:12:17
categories: Programming
tags: VIM
cover: images/cover/terminal_2.png

---

# macOS 压缩

gtar --exclude=.git --exclude=.gitignore --exclude=.DS_Store --exclude=build --exclude=.vscode --exclude=.gitattributes -czvf my_codes.tar.gz ./my_codes

# general linux 下压缩

tar -czvf ./backup.tar.gz ./current_folder

# linux 下解压缩

tar -xzvf ./backup.tar.gz --no-same-owner

