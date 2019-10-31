/**
# Truffle Decoder

This module provides an interface for decoding contract state, transaction
calldata, and events.  It's an interface to the same low-level decoding
functionality that Truffle Debugger uses.  However, it has additional
functionality that the debugger does not need, and the debugger has additional
functionality that this interface either does not need or cannot currently
replicated.  In the future, this interface will also decode return values and
revert strings.

The interface is split into three classes: The wire decoder, the contract
decoder, and the contract instance decoder.  The wire decoder is associated to
the project as a whole and decodes transaction calldata and events.  The
contract decoder is associated to a specific contract class.  It has all the
capabilities of the wire decoder, but in addition it acts as a factory for
contract instance decoders.  The contract instance decoder is associated to a
specific contract instance; it too has all the capabilities of the wire decoder,
but it can also decode the state variables for the specific instance.  (In
addition, in the case that the contract does not include a `deployedBytecode`
field in its artifact, which can hinder decoding certain things, the contract
instance decoder can sometimes work around this where the other decoders
cannot.)

This documentation describes the current state of the decoder, but you should
expect to see improvements soon.  Note that most of the documentation is not
found in this README, but rather in this package's API documentation.  However,
this README describes the overall approach.

## Usage

### Initialization

Create a decoder with one of the various constructor functions.

For a wire decoder, use the [[forProject|`forProject`]] function.

For a contract decoder, use the [[forArtifact|`forArtifact`]] or
[[forContract|`forContract`]] function.

For a contract instance decoder, use one of the following:
* [[forDeployedArtifact|`forDeployedArtifact`]]
* [[forDeployedContract|`forDeployedContract`]]
* [[forArtifactAt|`forArtifactAt`]]
* [[forContractAt|`forContractAt`]]
* [[forContractAbstraction|`forContractAbstraction`]]

See the API documentation of these functions for details, or below for usage
examples.

All of these functions presently require a final argument containing all
artifacts that could potentially be relevant.  It's intended that this argument
will be optional in the future.

### Decoder methods

See the documentation for the individual decoder classes for a method listing.

### Output format information

The decoder outputs lossless, machine-readable [[Format.Values.Result]] objects
containing individual decoded values. See the [[Format|Format documentation]]
for an overview and complete module listing.

### Decoding modes and abification

The decoder can operate in either of two modes: Full mode or ABI mode.  In ABI
mode, it decodes purely based on the information in the ABI.  In full mode, it
uses Solidity AST information to provide a more detailed decoding.  Due to
various technical reasons, full mode is not always reliably available.  The only
way to guarantee the use of full mode is if all your contracts are written in
Solidity (version 0.4.9 or later) and they were all compiled simultaneously.

The decoder will always run in full mode when possible, but sometimes the
necessary information may be missing or, for technical reasons, unusable.  In
this case, it will fall back into ABI mode.  Decodings are always marked with
which mode produced them so you can distinguish, as the format of a result may
differ substantially due to which mode was used.  Full mode is only available
for Solidity contracts and only for Solidity versions 0.4.9 or later; ABI mode
works with anything using the Solidity ABI.

If you want to simplify matters and to not have to deal with this distinction,
the decoder provides methods for converting a given decoding to ABI mode.  So
you can run the decoder in whatever mode it runs in, then run the result through
these methods to ensure you get an ABI mode result.  As noted above, there's
no way to ensure you get a full mode result.

(There are two slight differences between running the decoder in full mode and
abifying afterward, versus simply running the decoder in ABI mode.  Firstly,
full mode will reject certain invalid decodings that ABI mode cannot recognize
as invalid.  Secondly, the abified version of a full-mode decoding does contain
slightly more information than an actual ABI-mode decoding, just in an
ABI-mode-compatible format.)

Note that modes are always applied at the level of the whole decoding; different
variables in the same decoding will always be decoded with the same mode.
However, if an object (such as a log) admits *multiple* decodings, these
different decodings may occur in different modes.

Note that decoding of state variables is only available in full mode; attempting
to decode state variables will result in an exception if full mode is not
possible.

### Basic usage examples

#### Decoding a log with the wire decoder

This usage example is for a project with two contracts, `Contract1` and
`Contract2`.

```typescript
import { forProject } from "@truffle/decoder";
const contract1 = artifacts.require("Contract1");
const contract2 = artifacts.require("Contract2");
const provider = web3.currentProvider;
const decoder = await Decoder.forProject(provider, [contract1, contract2]);
const decodedLog = await decoder.decodeLog(log);
```

The usage of [[WireDecoder.decodeTransaction|decodeTransaction]] is similar.

For getting already-decoded logs meeting appropriate conditions, see
[[WireDecoder.events]].

#### Decoding state variables with the contract instance decoder

This usage example is for decoding the state variables of a contract `Contract`
in a project that also contains a contract `OtherContract`.

```typescript
import { forContract } from "@truffle/decoder";
const contract = artifacts.require("Contract");
const otherContract = artifacts.require("OtherContract");
const decoder = await Decoder.forContract(contract, [otherContract]);
const instanceDecoder = await decoder.forInstance();
const variables = await instanceDecoder.variables();
```

In this example, we use the deployed version of `Contract`.  If we wanted an
instance at a different address, we could pass the address to `forInstance`.

In addition, rather than using `forContract` and then `forInstance`, we could
also use [[forDeployedContract|`forContractInstance`]] to perform both of these
in one step.  If we wanted to do this with a specified address, we could use
[[forContractAt|`forContractAt`]].

Yet another way would be:
```typescript
import { forContractAbstraction } from "@truffle/decoder";
const contract = artifacts.require("Contract");
const otherContract = artifacts.require("OtherContract");
const deployedContract = await contract.deployed();
const instanceDecoder = await Decoder.forContractAbstraction(deployedContract, [otherContract]);
const variables = await instanceDecoder.variables();
```

These examples are not exhaustive.

See the API documentation for more advanced decoding examples with
[[ContractInstanceDecoder.variable|`variable`]] or
[[ContractInstanceDecoder.watchMappingKey|`watchMappingKey`]].
 *
 * @module @truffle/decoder
 */ /** */

import {
  ContractDecoder,
  ContractInstanceDecoder,
  WireDecoder
} from "./decoders";
export { ContractDecoder, ContractInstanceDecoder, WireDecoder };

export {
  ContractBeingDecodedHasNoNodeError,
  ContractAllocationFailedError
} from "./errors";

export {
  ContractState,
  StateVariable,
  DecodedTransaction,
  DecodedLog,
  EventOptions
} from "./types";

import { Provider } from "web3/providers";
import { ContractObject } from "@truffle/contract-schema/spec";
import { ContractConstructorObject, ContractInstanceObject } from "./types";

/**
 * **This function is asynchronous.**
 *
 * Constructs a wire decoder for the project.
 * @param provider The Web3 provider object to use.
 * @param artifacts A list of contract artifacts for contracts in the project.
 *
 *   Contract constructor objects may be substituted for artifacts, so if
 *   you're not sure which you're dealing with, it's OK.
 *
 *   This parameter is intended to be made optional in the future.
 * @category Provider-based Constructor
 */
export async function forProject(
  provider: Provider,
  artifacts: ContractObject[]
): Promise<WireDecoder> {
  return new WireDecoder(artifacts, provider);
}

/**
 * **This function is asynchronous.**
 *
 * Constructs a contract decoder for a given contract artifact.
 * @param artifact The artifact for the contract.
 *
 *   A contract constructor object may be substituted for the artifact, so if
 *   you're not sure which you're dealing with, it's OK.
 * @param provider The Web3 provider object to use.
 * @param artifacts A list of artifacts for other contracts in the project that may be relevant
 *   (e.g., providing needed struct or enum definitions, or appearing as a contract type).
 *
 *   Contract constructor objects may be substituted for artifacts, so if
 *   you're not sure which you're dealing with, it's OK.
 *
 *   Including the contract itself here is fine; so is excluding it.
 *
 *   This parameter is intended to be made optional in the future.
 * @category Provider-based Constructor
 */
export async function forArtifact(
  artifact: ContractObject,
  provider: Provider,
  artifacts: ContractObject[]
): Promise<ContractDecoder> {
  artifacts = artifacts.includes(artifact)
    ? artifacts
    : [artifact, ...artifacts];
  let wireDecoder = await forProject(provider, artifacts);
  let contractDecoder = new ContractDecoder(artifact, wireDecoder);
  await contractDecoder.init();
  return contractDecoder;
}

/**
 * **This function is asynchronous.**
 *
 * Constructs a contract decoder for a given contract.
 * @param contract The contract constructor object corresponding to the type of the contract.
 * @param artifacts A list of artifacts for other contracts in the project that may be relevant
 *   (e.g., providing needed struct or enum definitions, or appearing as a contract type).
 *
 *   See the artifacts parameter documentation on [[forArtifact]] for more detail.
 *
 *   This parameter is intended to be made optional in the future.
 * @category Truffle Contract-based Constructor
 */
export async function forContract(
  contract: ContractConstructorObject,
  artifacts: ContractObject[]
): Promise<ContractDecoder> {
  return await forArtifact(contract, contract.web3.currentProvider, artifacts);
}

/**
 * **This function is asynchronous.**
 *
 * Constructs a contract instance decoder for a deployed contract instance.
 * @param artifact The artifact corresponding to the type of the contract.
 *
 *   A contract constructor object may be substituted for the artifact, so if
 *   you're not sure which you're dealing with, it's OK.
 * @param provider The Web3 provider object to use.
 * @param artifacts A list of artifacts for other contracts in the project that may be relevant
 *   (e.g., providing needed struct or enum definitions, or appearing as a contract type).
 *
 *   See the artifacts parameter documentation on [[forArtifact]] for more detail.
 *
 *   This parameter is intended to be made optional in the future.
 * @category Provider-based Constructor
 */
export async function forDeployedArtifact(
  artifact: ContractObject,
  provider: Provider,
  artifacts: ContractObject[]
): Promise<ContractInstanceDecoder> {
  let contractDecoder = await forArtifact(artifact, provider, artifacts);
  let instanceDecoder = await contractDecoder.forInstance();
  return instanceDecoder;
}

/**
 * **This function is asynchronous.**
 *
 * Constructs a contract instance decoder for a deployed contract instance.
 * @param contract The contract constructor object corresponding to the type of the contract.
 * @param artifacts A list of artifacts for other contracts in the project that may be relevant
 *   (e.g., providing needed struct or enum definitions, or appearing as a contract type).
 *
 *   See the artifacts parameter documentation on [[forArtifact]] for more detail.
 *
 *   This parameter is intended to be made optional in the future.
 * @category Truffle Contract-based Constructor
 */
export async function forDeployedContract(
  contract: ContractConstructorObject,
  artifacts: ContractObject[]
): Promise<ContractInstanceDecoder> {
  let contractDecoder = await forContract(contract, artifacts);
  let instanceDecoder = await contractDecoder.forInstance();
  return instanceDecoder;
}

/**
 * **This function is asynchronous.**
 *
 * Constructs a contract instance decoder for a contract instance at a given address.
 * @param artifact The artifact corresponding to the type of the contract.
 *
 *   A contract constructor object may be substituted for the artifact, so if
 *   you're not sure which you're dealing with, it's OK.
 * @param provider The Web3 provider object to use.
 * @param address The address of the contract instance to decode.
 *
 *   Address must either be checksummed, or in all one case to circumvent the checksum.
 *   Mixed-case with bad checksum will cause this function to throw an exception.
 * @param artifacts A list of artifacts for other contracts in the project that may be relevant
 *   (e.g., providing needed struct or enum definitions, or appearing as a contract type).
 *
 *   See the artifacts parameter documentation on [[forArtifact]] for more detail.
 *
 *   This parameter is intended to be made optional in the future.
 * @category Provider-based Constructor
 */
export async function forArtifactAt(
  artifact: ContractObject,
  provider: Provider,
  address: string,
  artifacts: ContractObject[]
): Promise<ContractInstanceDecoder> {
  let contractDecoder = await forArtifact(artifact, provider, artifacts);
  let instanceDecoder = await contractDecoder.forInstance(address);
  return instanceDecoder;
}

/**
 * **This function is asynchronous.**
 *
 * Constructs a contract instance decoder for a contract instance at a given address.
 * @param contract The contract constructor object corresponding to the type of the contract.
 * @param address The address of the contract instance to decode.
 *
 *   Address must either be checksummed, or in all one case to circumvent the checksum.
 *   Mixed-case with bad checksum will cause this function to throw an exception.
 * @param artifacts A list of artifacts for other contracts in the project that may be relevant
 *   (e.g., providing needed struct or enum definitions, or appearing as a contract type).
 *
 *   See the artifacts parameter documentation on [[forArtifact]] for more detail.
 *
 *   This parameter is intended to be made optional in the future.
 * @category Truffle Contract-based Constructor
 */
export async function forContractAt(
  contract: ContractConstructorObject,
  address: string,
  artifacts: ContractObject[]
): Promise<ContractInstanceDecoder> {
  let contractDecoder = await forContract(contract, artifacts);
  let instanceDecoder = await contractDecoder.forInstance(address);
  return instanceDecoder;
}

/**
 * **This function is asynchronous.**
 *
 * Constructs a contract instance decoder for a given contract instance.
 * @param contract The contract abstraction object corresponding to the contract instance.
 * @param artifacts A list of artifacts for other contracts in the project that may be relevant
 *   (e.g., providing needed struct or enum definitions, or appearing as a contract type).
 *
 *   See the artifacts parameter documentation on [[forArtifact]] for more detail.
 *
 *   This parameter is intended to be made optional in the future.
 * @category Truffle Contract-based Constructor
 */
export async function forContractInstance(
  contract: ContractInstanceObject,
  artifacts: ContractObject[]
): Promise<ContractInstanceDecoder> {
  return await forContractAt(contract.constructor, contract.address, artifacts);
}
