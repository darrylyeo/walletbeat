import * as crypto from 'node:crypto'
import path from 'node:path'

import { loadConfig, optimize } from 'svgo'
import { describe, expect, it } from 'vitest'

import {
	CodebaseEntryType,
	commonExclusions,
	crawlCodebase,
	getRepositoryRoot,
} from './utils/codebase'

/**
 * SHA-256 hashes of SVG files that are already verified as fully optimized.
 *
 * To add a new hash: run the test, copy the printed hash for an already-optimized
 * SVG, and add it to this map with the relative file path as the key.
 *
 * Format: "relative/path/to/file.svg": "<sha256-hex>"
 */
const optimizedSvgHashes: Record<string, string> = {
	'public/fonts/sp-monorium-dingbat.svg':
		'4e075d1a474e3c9cac32668b882f38dea406bfd0f254767a4bfad9ff9fe47e3e',
	'public/fonts/sp-monorium-regular.svg':
		'eee6e8214eed53844156f73e7e053cce6124224642fe5366a5e9f22744d2d214',
	'public/images/entities/alphabet.svg':
		'a24bde56c35e9eab29554400ebb75fb3a4cabe4c16f926e39e7529b11bb4f2da',
	'public/images/entities/apple.svg':
		'9245279d530cef0ef065fd9826315c87bf7a9dd1c08389a92b3e536988a4f6ef',
	'public/images/entities/binance.svg':
		'73ea8ef4aa001815e87193e766e07711c53e7eee77da8c4d3a33253219a74e02',
	'public/images/entities/coinbase.svg':
		'3dc6fabdf014bd2c84c898f25061c1338b035a654a5085a33bc9320c763e5a2b',
	'public/images/entities/consensys.svg':
		'44959feb6557c1b5368ec530fbce0b396b951abac9e6699deef47f9eb8a13ac5',
	'public/images/entities/cyfrin.svg':
		'21fe59967163fadba08fc43d749bf1c5d47b9682dad09b6b4a3eeed173ff988b',
	'public/images/entities/daimo.svg':
		'df81d4badc2f668e5d655676bc6f5bec2170bb3807180ca74e81d84119a46c48',
	'public/images/entities/debank.svg':
		'a1eadd7dfef1a2df7f06c5f6d1161b366676a990d1a9b61f4553d879a21adf85',
	'public/images/entities/github.svg':
		'c7157b28bd2f0dbe2e9ce7c2ae67615248079b7f76b249d1f8d0db78137d0895',
	'public/images/entities/honeycomb.svg':
		'977c823032cc2a231364aee2b2c99807070ab33e37dd6539d43b2c858d36c999',
	'public/images/entities/keycard.svg':
		'f2aaf5cf2dcb11aef0e5c0295aeb68013b082d4f2b38e2a9cd0004d355098967',
	'public/images/entities/keylabs.svg':
		'cf4896b9928042eb6290b565515969e16963e15453985b8ca68f8456a8fd8694',
	'public/images/entities/ledger.svg':
		'f8114242b61fea3f79123a7be6164bfdf0fa3f3b138c13cc77a64dd1abdf81c7',
	'public/images/entities/lifi.svg':
		'f9c8d6a5d7dd191efd3afee236e9ce11fd8989f0fd45b512148935cffb4bb770',
	'public/images/entities/mtpelerin.svg':
		'cd22b6b4c491d2a140384dec2cdd752fd58eec6b93add208a5921073d245e727',
	'public/images/entities/uniswapLabs.svg':
		'a18c2925a3dd845d25008b6b21184e41c4974e37d9723b8331ed9e08676ab359',
	'public/images/entities/veridise.svg':
		'dc42d85f7cd9b301b9a651c1a58fa0122568d37b98037a34b0c04c6a544635f2',
	'public/images/ethereum-logo.svg':
		'864c8128b70339ff3420605f64d758e312ec86eb31414895e1780710e936e251',
	'public/images/wallets/ambire.svg':
		'9e414d63f37c859b4214b50599cb72094246ffe6b139c240528872c5e381cbff',
	'public/images/wallets/base-app.svg':
		'f6c413bf4e2974d56f333d1785114a5ae4899b4bd0800210234337d570710bcb',
	'public/images/wallets/bitbox.svg':
		'eaab1dc29fdabd41a268b5792ea2ea35bfeff8b65cb6ab6d41dd469eeb2db1b7',
	'public/images/wallets/bitget.svg':
		'968233f7a91ce969504621a344bcd0c6174d0cf25365bae8f80b46ddd6987793',
	'public/images/wallets/cypherock.svg':
		'39df85d3a83abe5b96c259e81a1dc3456fe81037e5f8f1eee9f1a1dc8a5fff65',
	'public/images/wallets/daimo.svg':
		'df81d4badc2f668e5d655676bc6f5bec2170bb3807180ca74e81d84119a46c48',
	'public/images/wallets/default.svg':
		'1240158a9077d0c37061cc1dbada4f77d7ec69f7ccd01e64e3cf2149e32dae55',
	'public/images/wallets/elytro.svg':
		'1a4f7a9a38e9093e68a60b4cca6e6c17e9b6b8d1813b4ea295e4c4c9a422c8b3',
	'public/images/wallets/frame.svg':
		'97c4b6b687e4d1854aa6b7e5367ed7b408cad385757da793f7229f549d956e15',
	'public/images/wallets/gemwallet.svg':
		'12b03ba1cf594a65093373f8d56205cab64777963428f10b925b361cb117339b',
	'public/images/wallets/gridplus.svg':
		'26f35949f6d02e13ab33c913dd7777231427415961213479798f9c8a10d835d4',
	'public/images/wallets/imkey.svg':
		'76ee1b87ceff067136f7aa81f9540a80bffd72f65aa80c88f6cfb0c244b9928a',
	'public/images/wallets/imtoken.svg':
		'ff157e238f8cb304d163c0318662ff5fd5b1e2c04d3a1bc274e2af11b6345c35',
	'public/images/wallets/keycard-shell.svg':
		'f2aaf5cf2dcb11aef0e5c0295aeb68013b082d4f2b38e2a9cd0004d355098967',
	'public/images/wallets/keystone.svg':
		'194e5e905123dbe83c6bae34551174e39c68f266d35263ace12d8772b10f8aeb',
	'public/images/wallets/ledger.svg':
		'f8114242b61fea3f79123a7be6164bfdf0fa3f3b138c13cc77a64dd1abdf81c7',
	'public/images/wallets/metamask.svg':
		'15d3e1ebc57320688fab839d040fc7a7e4557aea9f2ce388cb4736e8ff3bc353',
	'public/images/wallets/mtpelerin.svg':
		'2ef9baac2e6b46f7144d62afae8777abf433fffa3f8cfc6d41b64e4b1a2fa52e',
	'public/images/wallets/ngrave.svg':
		'21c5794b8ee248765d11c9e88d28a994fb568e938d8f69020340fa3418185e34',
	'public/images/wallets/nufi.svg':
		'84b00f3f0b3286455b585970d20a25ed9e85307e8654db0cf8fa1d72cde6c5c7',
	'public/images/wallets/onekey.svg':
		'eaa530c5a51bce045785a4c81d96e7ea636956e03cfcd75890ed5a64c9c83780',
	'public/images/wallets/phantom.svg':
		'7adaa526670b7917edbe7172e0d9555372808c5954c79c8a8e17bf15f40049df',
	'public/images/wallets/pillarx.svg':
		'e2dc12e35b6c865c1b85f7c975d6b6b14901b4993c44ca0526bbf8eaa6849812',
	'public/images/wallets/rabby.svg':
		'257d200d630310c5ab04d5310198549de9d4e94ff2095a3cd288db169ea8e13a',
	'public/images/wallets/rainbow.svg':
		'a4dff6569f4207605c3d6fe1b772d92610fdf5c6892a525f5c7b1185ea92c149',
	'public/images/wallets/safe.svg':
		'2c0111b3d8953b0a00f32a86fec4514aa0abf9d0b48d0eec730d2eadb869fba2',
	'public/images/wallets/trezor.svg':
		'c145a492cc3ee0c5a7653de05a22b34970bf2e4f43f6514920fec26d4cacf662',
	'public/images/wallets/uniswap-wallet.svg':
		'2265b5bd3b64bf72e29ed87476d5b2ac82f0bd1d9fef3e4c73f2336493ba6f8d',
	'public/images/wallets/zerion.svg':
		'5410793b34c576acf880bb16a42e537e98e3185bb76840888ceec26f517f0fdc',
	'public/images/wallets/zeus.svg':
		'81d3248eb033216dad88005dbaca90e637709c66351ad1f5e3a6a0a65b6b051b',
	'public/logo-dark.svg': '04cf9870dd9479a652d32cbeafa1296df0ad410f995b739157fdc5ccae3c5a5c',
	'public/logo-light.svg': 'be70e0dcb42ee49e13ccaead8eefd3b7199e8a0c53c4f55c644dbf839ca15cc3',
	'public/logo.svg': '04cf9870dd9479a652d32cbeafa1296df0ad410f995b739157fdc5ccae3c5a5c',
	'resources/branding/glow-0.svg':
		'5f40f64a49babed6573f5c16e39ec450eb83ef660efea7bcd30093fe19ac9a45',
	'resources/branding/glow-1.svg':
		'71e6c1520f6f9b40d189811b38f222a5381b1b01e9a281c1e55ef4941fafbed7',
	'resources/branding/icon_dark.svg':
		'01b1f93889464312f873bfcad2cd5b428f34114671c9a9113f55a2331935fc31',
	'resources/branding/icon_light.svg':
		'3fdcfcb71e3583b0292a12a37d7dc65369b8c2fffc437a7752deac877ec6c7a1',
	'resources/branding/logo_dark.svg':
		'04cf9870dd9479a652d32cbeafa1296df0ad410f995b739157fdc5ccae3c5a5c',
	'resources/branding/logo_light.svg':
		'be70e0dcb42ee49e13ccaead8eefd3b7199e8a0c53c4f55c644dbf839ca15cc3',
	'resources/contracts/images/Walletbeat.svg':
		'0c93bc98c4fd6e0770d5658e0860061c879457c79262ac014e49db5c6a033de6',
	'resources/files/wbicons/about.svg':
		'39d7264654baea899535659425ed8abe0704f9c54608c5d656fa487bd651ace9',
	'resources/files/wbicons/account_abstraction.svg':
		'4990e27a2c7723c2eab4f908af4fd909d54c449c3fe544ba904daf4d6427333a',
	'resources/files/wbicons/account_portability.svg':
		'f2c5217bb317174e53cdaa82c8ba5a9606d78409fff44990b7a5dc868d2d2e91',
	'resources/files/wbicons/account_recovery.svg':
		'adf696fefff1e3f1270c0b65794a9b9c4c4759e2cfc807d45141865b59a6db1b',
	'resources/files/wbicons/account_type.svg':
		'23a05dd8ff1194503a306a7c38965b6256e56d4a7cca12a68d55696d74e66cc2',
	'resources/files/wbicons/account_unruggability.svg':
		'c52c914044e4f1d3580e7dad5209c4251c55e0045cac35e41e8e8cccd5c9e163',
	'resources/files/wbicons/address_resolution.svg':
		'5e8000164f045b977c7cd23ba76eeea65f2a1e38198795f1532e5581f600a6dc',
	'resources/files/wbicons/app_isolation.svg':
		'4a92dd20d8838d64caf780c129b91dd93376834028694d5ce4e8dd9a3430a534',
	'resources/files/wbicons/browser_integration.svg':
		'ab1a6f45ab3cd41e935399455d623985c657330276018e8583164eb22695d84f',
	'resources/files/wbicons/chain_abstraction.svg':
		'7a2e5637c62e1a2c1fe81cc191a6a143735d90058016c840baac449efcbb089e',
	'resources/files/wbicons/chain_verification.svg':
		'bc28ceb71b51c81770ddc86264943d3fc9f4e8d6c5e69d56d3c117fa5cca2c37',
	'resources/files/wbicons/discuss.svg':
		'6d5a671275a97f5198aef73514f6a18374a74e44c83783a1fca89be58ba2ca94',
	'resources/files/wbicons/duress_resistance.svg':
		'18486864cdedf8fc09df7f0693c55815547b72a3cf9ddbada01f7b968ff20ecd',
	'resources/files/wbicons/ecosystem.svg':
		'e6321a1b073aacc4260fa52358079ebdf42426e675d71958743e97d374b150c1',
	'resources/files/wbicons/faq.svg':
		'a5d4036c33a801b5ce5555bb0348f16bd0ca34be63be502190c16b75e3f04b38',
	'resources/files/wbicons/fee_transparency.svg':
		'df48ca79d2da908d882e69b49e48d0b385c5ed6ecaff3f141260b9e64bc1b4f3',
	'resources/files/wbicons/free_and_open_source_license.svg':
		'62b3a5ed2b0f993bb64dfe180f6629dafb5e5343717dcf9c41b0d0a3dd69447c',
	'resources/files/wbicons/funding_transparency.svg':
		'e7c002fa1233cd97069336569cc7a6405915293b9556961058435c117886a850',
	'resources/files/wbicons/hardware_wallet_interoperability.svg':
		'c046083d10284cacd34657177de8f088fdb793e117d55315ff26e98aca7ed533',
	'resources/files/wbicons/hardware_wallet_support.svg':
		'5d792da41e2531db06aee988a49f680b01e8e5139bc68cdd0d1656aea29a9b12',
	'resources/files/wbicons/l1_provider_independence.svg':
		'a29e1c16e04d2c5592bb499086556447fdfc9df5398ba0467ac4e37f7c180fea',
	'resources/files/wbicons/multi_address_privacy.svg':
		'7428e824a6e2742066cc61e237e2c68537ceb2a5a0cd28d2e64b8ca62e1b8e44',
	'resources/files/wbicons/newsletter.svg':
		'0aab6c5f7f75a0b45737f2aa538dc23176eaee15776214ac22156a761bf3bf85',
	'resources/files/wbicons/orderflow_transparency.svg':
		'e27fc6f3b3bb6aadb0ae58245bb60d6cd2eeb2555aa1a2fe938fe5cc698add16',
	'resources/files/wbicons/passkey_verification.svg':
		'0f00a0f5da9d87750a286da9a23f7241ec9e6e204ed688e1432737d475e5919c',
	'resources/files/wbicons/permissions_management.svg':
		'b161d3b2d0ec579f480f75321a14158557d9def881de2ba63d63d44d90a96175',
	'resources/files/wbicons/privacy.svg':
		'fce9b9bfc99eae07e938f86998f9b211f4042625a840b6e60b1261244e860e5d',
	'resources/files/wbicons/privacy_hygiene.svg':
		'c825dfa57f4c6c5783fb638a86457d039b97b025b49ce0f16fa43a5ea2a8500d',
	'resources/files/wbicons/private_token_transfers.svg':
		'290349a4da4c7e82a29eeef00d8fd93f13322323d90a84978ba2fc4f1f90fe49',
	'resources/files/wbicons/question_mark.svg':
		'4e5813c58ea19dbb9ae2408af60381d1e01763fc22ac5be80e0e64d8201b1cd0',
	'resources/files/wbicons/release_process_transparency.svg':
		'9d4119eeb9cd36f8b8f9164351ac77cbd43d00a0d09e47f76f90be9093c8627b',
	'resources/files/wbicons/repository.svg':
		'3841f2a4f43540ce6c4ba969d9027ca97bec2e540ea75ffefbaa6b7fe7c39d3e',
	'resources/files/wbicons/scam_prevention.svg':
		'4ce7403d410258225ecfda384b6d420e543be8fdb6b4831747f6635eff8ab5c6',
	'resources/files/wbicons/security.svg':
		'b8a39689b37bd8a53182731f1feba4336e885c8c6775d070ff0ca4434e1ff46b',
	'resources/files/wbicons/security_audits.svg':
		'2d9c3570dd3abe439668021992560211954e02f343229e563925bc96aa809c5b',
	'resources/files/wbicons/security_best_practices.svg':
		'95dc3f16d3c4a72be71562a4d1be460aad7d6bbe26c79f4b1ac83908db38a24b',
	'resources/files/wbicons/self_sovereignty.svg':
		'c6ea42b41341adac0b4fcb721d772514e1aaab7896b3a6c1549519c61e1d9fb7',
	'resources/files/wbicons/source_visibility.svg':
		'42f6205568a6a5153ea37bfe43d8fa48b1122044c9317595e9632175ad6a8221',
	'resources/files/wbicons/transaction_batching.svg':
		'68e6b76258ca80b02f03412419ef4d5acb87e4c0665a5fbf4cefaa7f0f2c2adc',
	'resources/files/wbicons/transaction_inclusion.svg':
		'c7f9326105c92217a6cd5ac454a9a302dfaa48712e7d93d74438518a948d2ec8',
	'resources/files/wbicons/transaction_legibility.svg':
		'185c7349f050bba5bdfc2f47b056560b7056e648f92d11683568a8e759dc6561',
	'resources/files/wbicons/transparency.svg':
		'ecaee4e0090af3195102bc244332cdb032e74fbc279cd271a4d99e783cfe01b2',
	'resources/files/wbicons/user_privacy.svg':
		'424ff4db5750bc5fe9759397e12c94d0bce96efc5741d09537d1338af939cc7b',
	'resources/files/wbicons/wallet_address_privacy.svg':
		'd487fa4654eb3d0c06b118237e5d17ac15f29ad4f4f21753b8ff8ca46d6d3dbf',
	'resources/files/wbicons/wallet_browser.svg':
		'4bca4b5243cd8cfef6730f764c8726f35ce3968f3128f506e894dade7c9bbc63',
	'resources/files/wbicons/wallet_desktop.svg':
		'1281dc392e144a4b545aaf5e75e6ef7617522c50af2aa66346d76bbdb519d132',
	'resources/files/wbicons/wallet_embedded.svg':
		'b63e31d7aa10ba4822e1223c4a15311c2f2b01b1e7eb0fdb99d31b7042c0d25d',
	'resources/files/wbicons/wallet_hardware.svg':
		'cd31514d5c72da2374a0828685533d206ac8922ec4d4adfa52588a26caaaaded',
	'resources/files/wbicons/wallet_mobile.svg':
		'dba5ad8b24a91d229e696dd8a5f6073731a52a057168c7d86b2154350a888544',
	'resources/files/wbicons/wallet_software.svg':
		'7391798a2aa19ba374eab3bfcef39eccaf575de2d7bc9e4fe8a8e2269bc9ca0f',
	'resources/files/wbicons/wallet_test.svg':
		'da072830acbce4bd7b89039e3ae261f95f79e620a468eada968dcc5220c34806',
}

interface SvgResult {
	filePath: string
	status: 'needs_optimization' | 'already_optimized' | 'skipped'
	currentHash: string
	originalSize: number
	optimizedSize: number
}

describe('SVG optimization', async () => {
	const configPath = path.join(getRepositoryRoot(), 'tests/utils/svgo.config.mjs')
	const svgoConfig = await loadConfig(configPath)
	const configHash = crypto.createHash('sha256').update(JSON.stringify(svgoConfig)).digest('hex')
	const results: SvgResult[] = []

	await crawlCodebase({
		ignore: commonExclusions.concat([
			// Generated font output is covered by the icon font generator hash.
			filePath => filePath.startsWith('src/assets/fonts/'),
		]),
		complexTraversalFn: async (entryBase, getFullEntry) => {
			if (entryBase.type !== CodebaseEntryType.FILE) {
				return
			}

			if (!entryBase.path.endsWith('.svg')) {
				return
			}

			const entry = await getFullEntry()

			if (entry.type !== CodebaseEntryType.FILE) {
				throw new Error('inconsistent type')
			}

			const filePath = entry.path

			// The hash depends on both the config and the file contents,
			// so concatenate them to force re-run on SVGO config changes:
			const currentHash = crypto
				.createHash('sha256')
				.update(configHash)
				.update('||||')
				.update(entry.contents)
				.digest('hex')

			// Skip if hash matches a known-optimized SVG.
			if (optimizedSvgHashes[filePath] === currentHash) {
				results.push({
					filePath,
					status: 'skipped',
					currentHash,
					originalSize: entry.contents.length,
					optimizedSize: -1,
				})

				return
			}

			// Run SVGO optimize on the SVG content.
			const result = optimize(entry.contents, {
				path: filePath,
				...svgoConfig,
			})

			const originalSize = entry.contents.length
			const optimizedSize = result.data.length

			if (optimizedSize < originalSize) {
				results.push({
					filePath,
					status: 'needs_optimization',
					currentHash,
					originalSize,
					optimizedSize,
				})
			} else {
				results.push({
					filePath,
					status: 'already_optimized',
					currentHash,
					originalSize,
					optimizedSize,
				})
			}
		},
	})

	results.sort((a, b) => a.filePath.localeCompare(b.filePath))

	it('found SVG files to process', () => {
		expect(results.length, 'No SVG files were found by the crawler').toBeGreaterThan(0)
	})

	it('all SVGs should be optimized (no byte-size reduction possible)', () => {
		const needsOptimization = results.filter(r => r.status === 'needs_optimization')

		if (needsOptimization.length > 0) {
			const message =
				'The following SVG files can be further optimized:\n\n' +
				needsOptimization
					.map(r => {
						const savings = r.originalSize - r.optimizedSize

						return (
							`  ${r.filePath} (${r.originalSize} → ${r.optimizedSize} bytes, ${savings} bytes can be saved)\n` +
							`    npx svgo --config ${configPath} ${r.filePath}`
						)
					})
					.join('\n\n') +
				(needsOptimization.length === 1
					? ''
					: '\n\n==== Single command: ====\n\n    ' +
						needsOptimization
							.map(r => `npx svgo --config ${configPath} ${r.filePath}`)
							.join(' && ') +
						'\n\n')

			console.error(message)
			expect(
				needsOptimization.length,
				`${needsOptimization.length} SVG file(s) can be further optimized. See error output for details.`,
			).toBe(0)
		}
	})

	it('contains all hashes for already-optimized SVGs', () => {
		const alreadyOptimized = results.filter(r => r.status === 'already_optimized')

		if (alreadyOptimized.length > 0) {
			const message =
				'\nThe following SVG files are already optimized but not yet in the known-optimized list.\n' +
				'Add these hashes to `optimizedSvgHashes` in tests/svg-optimization.test.ts:\n\n' +
				alreadyOptimized.map(r => `    '${r.filePath}': '${r.currentHash}',`).join('\n') +
				'\n\n'

			process.stderr.write(message)

			expect(
				alreadyOptimized.length,
				`${alreadyOptimized.length} SVG file(s) are already optimized but missing from optimizedSvgHashes. See error output for hashes to add.`,
			).toBe(0)
		}
	})

	it('all optimizedSvgHashes entries should correspond to actual SVG files', () => {
		const existingPaths = new Set(results.map(r => r.filePath))
		const staleKeys = Object.keys(optimizedSvgHashes).filter(path => !existingPaths.has(path))

		if (staleKeys.length > 0) {
			const message =
				'The following optimizedSvgHashes entries do not correspond to actual SVG files in the repo.\n' +
				'Remove these keys from `optimizedSvgHashes` in tests/svg-optimization.test.ts:\n\n' +
				staleKeys.map(k => `    ${k}`).join('\n') +
				'\n'

			process.stderr.write(message)
			expect(
				staleKeys.length,
				`${staleKeys.length} optimizedSvgHashes entry/entries reference non-existent SVG file(s). See error output for keys to remove.`,
			).toBe(0)
		}
	})
})

/**
 * Threshold: if the raw text of embedded data: URIs (as they appear in the
 * file) compose more than this fraction of the SVG file size, the file is
 * flagged as a disguised raster image (PNG/JPEG/WebP inside an SVG wrapper).
 */
const EMBEDDED_IMAGE_RATIO_THRESHOLD = 0.95

describe('SVG files should not be disguised raster images', async () => {
	const disguised: {
		filePath: string
		fileSize: number
		embeddedSize: number
		ratio: number
		mimeType: string
	}[] = []

	await crawlCodebase({
		ignore: commonExclusions,
		complexTraversalFn: async (entryBase, getFullEntry) => {
			if (entryBase.type !== CodebaseEntryType.FILE) {
				return
			}

			if (!entryBase.path.endsWith('.svg')) {
				return
			}

			const entry = await getFullEntry()

			if (entry.type !== CodebaseEntryType.FILE) {
				throw new Error('inconsistent type')
			}

			const contents = entry.contents
			const fileSize = entry.raw.byteLength

			// Match data: URIs in attributes like xlink:href, href, src.
			// Captures: data:<mime>;<params>,<raw-content>
			const dataUriRegex = /data:\s*([\w/.+-]+);[^,]*,([^"'>\s]+)/g
			let match
			let embeddedSize = 0
			let mimeType = ''

			while ((match = dataUriRegex.exec(contents)) !== null) {
				mimeType = match[1]

				// Count the full data URI text as it appears in the file
				// (the raw base64 or plain text, not the decoded bytes).
				// This correctly reflects how much of the SVG is consumed
				// by the embedded image wrapper.
				embeddedSize += match[0].length
			}

			if (embeddedSize > 0) {
				const ratio = embeddedSize / fileSize

				if (ratio > EMBEDDED_IMAGE_RATIO_THRESHOLD) {
					disguised.push({
						filePath: entry.path,
						fileSize,
						embeddedSize,
						ratio,
						mimeType,
					})
				}
			}
		},
	})

	it('no SVGs should be disguised raster images', () => {
		if (disguised.length > 0) {
			disguised.sort((a, b) => b.ratio - a.ratio)

			const message =
				'The following SVG files are disguised raster images — they consist almost entirely of an embedded data: URI rather than real SVG vector data.\n' +
				'Replace these with actual SVG vector files or use the raster image directly.\n\n' +
				disguised
					.map(
						d =>
							`  ${d.filePath}\n` +
							`    File size:    ${d.fileSize.toLocaleString()} bytes\n` +
							`    Embedded:     ${d.embeddedSize.toLocaleString()} bytes (${(d.ratio * 100).toFixed(1)}% of file)\n` +
							`    MIME type:    ${d.mimeType}`,
					)
					.join('\n\n') +
				'\n'

			console.error(message)
			expect(
				disguised.length,
				`${disguised.length} SVG file(s) contain embedded raster data exceeding ${EMBEDDED_IMAGE_RATIO_THRESHOLD * 100}% of the file size.`,
			).toBe(0)
		}
	})
})
