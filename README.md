# Fabric 银行网络

## 项目结构

```
.
├── config/                  # 配置文件目录（手动编写的配置）
├── fabric-ca/               # Fabric CA 数据目录（运行时生成）
├── crypto-config/           # 自动生成的证书和密钥（运行时生成）
├── docker-compose-ca.yaml   # 自动生成的 Docker Compose 配置文件
├── generate-crypto.sh       # 自动生成的证书生成脚本
└── scripts/                 # 手动编写的脚本
    └── setup-network.sh     # 网络设置脚本
```

## 文件分类

### 手动编写的文件
- `scripts/setup-network.sh`: 主要配置脚本，用于设置网络并生成其他文件
- `config/` 目录下的所有配置文件

### 自动生成的文件
- `docker-compose-ca.yaml`: 自动生成的 Docker Compose 配置文件
- `generate-crypto.sh`: 自动生成的证书生成脚本
- `crypto-config/`: 生成的证书和密钥
- `fabric-ca/`: CA 服务器数据目录

## 使用方法

1. 配置网络：
   ```
   ./scripts/setup-network.sh
   ```
   按照提示输入银行数量和相关信息。

2. 启动 CA 服务：
   ```
   docker-compose -f docker-compose-ca.yaml up -d
   ```

3. 生成证书：
   ```
   ./generate-crypto.sh
   ```

## 注意事项

- 自动生成的文件（`docker-compose-ca.yaml`, `generate-crypto.sh`, `crypto-config/`, `fabric-ca/`）不应手动修改
- 自定义配置应放在 `config/` 目录中
- 自定义脚本应放在 `scripts/` 目录中 