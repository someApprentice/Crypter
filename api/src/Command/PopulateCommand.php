<?php
namespace Crypter\Command;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Helper\ProgressBar;

use GuzzleHttp\Client;

putenv('GNUPGHOME' . __DIR__ . '/../../var/.gnupg');

class PopulateCommand extends Command
{
    protected static $defaultName = 'crypter:populate';

    protected function configure() {
        $this
            ->setDescription('Populate database with conferences between alice@crypter.com, bob@crypter.com, tester@crypter.com (passwords for each one is "password")')
            ->setHelp('Populate database with conferences between alice@crypter.com, bob@crypter.com, tester@crypter.com (passwords for each one is "password")')
        ;
    }

    public function __construct(bool $requirePassword = false)
    {
        $this->requirePassword = $requirePassword;

        parent::__construct();

        $this->addOption(
            'iterations',
            'i',
            InputOption::VALUE_REQUIRED,
            'How many messages should be between users?',
            100
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output)
    {
        $client = new Client([
            'base_uri' => 'http://localhost'
        ]);

        $output->writeln('Populate Alice');

        // should probably be somewhere in a file
        $alicePublicKey = <<<EOT
-----BEGIN PGP PUBLIC KEY BLOCK-----

mQENBF4+/fYBCAC/urp4OHNq+i4z9bCNxlZf62SSr4nH1fmYdtNNX8x6PwuT2Pjr
gW4kLd5qkB5kxXGWomiJ4NkoiDyFa5xcbRUOZM9viCh8G/LjB1Y0/hF9fUGj5ZXx
b3DUTCZYNkUbRqC4lFV8Xt97eA5/UyXm8vIB8hj6ceNj9yBP9rgEzVfYlXKER4fw
W6zP3o7N+EqKd+sYtS537DiJhFcz7K6ubdrfFJPdPdg9uuQtlQgW4FwqHDeUyVZH
WNEwT7qi393MY8kgpNgGuVswxh5unQ1x2IC1F1vPo2fo8Ra7h7A7m21fware20d8
1N12hGntRDtZtmlK9Irdi3hX9pOGUgHDcIeVABEBAAG0GUFsaWNlIDxhbGljZUBj
cnlwdGVyLmNvbT6JAVQEEwEIAD4WIQTFGQrFMkTMEHk61nz6+DwQK9ZvGgUCXj79
9gIbAwUJA8JnAAULCQgHAgYVCgkICwIEFgIDAQIeAQIXgAAKCRD6+DwQK9ZvGisL
B/9TN6a0DI4JXO0vmyzSlWOj7FsZW+1xaT85OCcmX8vxmW/AjCmgiOybbPXjHmfO
IYjR6NLLPLsw+z/Om5g9LT2XKNFjEae4x8+NueaoUWQlVFeFrL4qbjTMf6zzPfaJ
bNB8fggNQZ5Bp1l488PXD7/V1RCQNc9GTmkbPRcvXeYaSX7oeDE8uyGn7g9A30Ih
LGu3DNGl+jCCI8z+VFkBKfvn4/t8MIN3LCmjpF7fwGWqcoj/qSBKMTTyOWiLskT7
8+9wIl1iO9xlZJaoEnO9wzArWlKd+k7022HsdGDbPacOT1YxDWKqbw9PHnDN0agI
Tx4lW2lfolFOm3TMiZSRTeuwuQENBF4+/fYBCADs9k/xVsDlXT9L1X4JgMughzux
v9pt+yZ94KBDTSeIZElh5WE8ZbCtpo69osYkx7H5et5FsykKCn0woYDb2nEdKnWX
nFpJKG9nODha2BWIyHtfwEfmf5U/3ISXJbO2/t3f3ox+FflUWmkBKnpGH1ipPPFK
m2X/xKUFGM43vsqhID1R1JqL+VG6SNOUiYpDPnm22tYcxma8rITg3+y5eCfD1G4W
NcG/4+zTwRCwlMW2Y5EKVDlk86BzIBdy1hZ2cNyx/naHctpgIGfiScyNuXgVvcB8
hrNLHKR4yF6xLs/fxgsNlQxmoVshvd5ZbOCwCkuwqELMkoNi0YIlG1C1SIj7ABEB
AAGJATwEGAEIACYWIQTFGQrFMkTMEHk61nz6+DwQK9ZvGgUCXj799gIbDAUJA8Jn
AAAKCRD6+DwQK9ZvGoBUCACy2HeJSonBwQu6fjKqjcYHS+9Z3t97+HahFQ/5M378
LZ/6Ba7cVVoRrkQAj0VIwu/6LQ1MevGuAkFSdsm48VwH7NqT11Bz1DjE+bcu+6Ow
DFrDneQJRXke5exCuk0e3FPCjDDE+YwkH/Un3afG62teJkIb30+T37V+MnLO/iBv
BX0KW0A/PjnJSB+acmxEeUbwRJ4bsi0CNknn9xZ42OAw9So5Kh8MZ9xdNJzi9Wg7
CCwFi022jN4drTEmdtQeBLYeimvbn9K0PcCCuTnlPsLWnS2hhIHuIAeIk6FsmWwq
FwM1xet/o0tcetH7dwlg7BeY0iW9+ATZYa7O89d2sJry
=UFIU
-----END PGP PUBLIC KEY BLOCK-----
EOT;
        $alicePrivateKey = <<<EOT
-----BEGIN PGP PRIVATE KEY BLOCK-----

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
=DJCg
-----END PGP PRIVATE KEY BLOCK-----
EOT;

        $aliceRevocationCertificate = <<<EOT
-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: This is a revocation certificate

iQE2BCABCAAgFiEExRkKxTJEzBB5OtZ8+vg8ECvWbxoFAl4+/sQCHQAACgkQ+vg8
ECvWbxqq1ggAmvaAq3nhgWbxKJXmEEouUd3nSOMq4yW7fPYyrz+TAz35jDqVJj3C
vGJeFjQCWMOPod2hq5qij2i2U/PLDEjLknnq8j8nnPGhcKbzX6UjUKoYnR7GQktN
UJbVjOyuzazhOYvnAlbX+Nn9tCfAUkuM9rA0L9arO9HWtn/4lyeUT2GMfAxM6RGu
54Izf3/eM1AoOzpyEaylRWvRTIJO22d22pp09HSlRdTah1l8I6iJryb0o2/8i1BD
AzT7/xDmwMM+Kc2CBVuuSiijGRIQqE27Y9uIn6QNBUFkXZ2dB7CBNAFJCE6tj9mn
uVic4/2e3Xy+7n0IpbIPaK2QhdnyYv1xLA==
=7YVe
-----END PGP PUBLIC KEY BLOCK-----
EOT;

        $response = $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $options = [
                'headers' => [
                    'CONTENT_TYPE' => 'application/json'
                ],
                'json' => [
                    'email' => 'alice@crypter.com',
                    'name' => 'Alice',
                    'password' => 'password',
                    'public_key' => $alicePublicKey,
                    'private_key' => $alicePrivateKey,
                    'revocation_certificate' => $aliceRevocationCertificate
                ]
            ],
            // $files = [],
            // $server = [
            //     'CONTENT_TYPE' => 'application/json'
            // ]
        );

        $alice = json_decode($response->getBody(), $assoc = true);


        $output->writeln('Populate Bob');

        $bobPublicKey = <<<EOT
-----BEGIN PGP PUBLIC KEY BLOCK-----

mQENBF4/AVQBCADQeV5pWo5LVJ3C/KWLF3sRWRdZCHRdr591+KBC/PP0lU+lj/TF
MULr02tdwE96B1ZQHMMbMWXFCKyfD9fPZgBmfz6s2Y6dzm+rRlSc9F4TqwtVQKr4
Ssy1DCajf4lsNsRDf71gxnRba2MzE+g5p1iqp20Ih5KApY7JGoqREzB7nbVTSW9f
cLzNTTjyZtS5w206O/UFoMq81BPb3tp6C8Jn7YbxMnY4sM9jN889Vihymdl4uiwi
3X/vn1+S6JmRQCmX9KZjR/5AIS/pSTzhlHDEvqGFV0YoyVN9MliLkhtDQU293LTV
vjwIg9FGeG1ggpDCygNzq7y6Sh6M+6WzQ4+XABEBAAG0F0JvYmJ5IDxib2JAY3J5
cHRlci5jb20+iQFUBBMBCAA+FiEEG/0j8D10J9kXmtqFbHCLBzit02oFAl4/AVQC
GwMFCQPCZwAFCwkIBwIGFQoJCAsCBBYCAwECHgECF4AACgkQbHCLBzit02otKQf+
Oiomaay/BhJntFH8FRmeZ7R9F5B5RiGxa81nBoXIhAzqDCv1GFIgohbhOVf8NUkL
5AaGnVGIbjEyuqsKZ4u3FbMnCkSLLGtp+Ce6VoX0wXQlZhVX1PK1XemYuPnY2ULc
FdHoehX5kf7y8TKbwbWkzArSIgNBJgRQjIHrWS115VT/kF4O9ZkPjIZ4IC/5YmCM
346pEkiWKDmXrMNik9YaSINfFB2rW1PwvuVy4Xp+0qEf0B7PnateUAZL9/Y8AGmy
4XCNPRe0XnnG9W5Ob6ZMB1IriKlpnUE2E9NHUlYvRB+ZAD8J8mshAWU75ssQ7bh3
+iDHHQlsHAtND7hgg0lg2LkBDQRePwFUAQgAxuy49fnJEGpCzFu2AnHyrsG4ogOg
Ry1ikb5BjUUTsccNUk72VbYWI9wH2LMVC06tNC+LEoCmCJKLpq0fXaCSQoys+N4d
0OqM2RZUFYO55yBX/BkwA8txhC/HOlMwat/HGRdoiN+2DFfVHALXSM3oV/8KNXm4
agM8d+5u2K2JEy74Os9gbnUaXTpj9Kj9KKmlPlWLebi+8Cz48nWExHoTzmbnwFBP
hF+VT7x1/QUPDMWOceMt1KayvUqS2xsThSt3GyXqNSlmL4QZpWONua7vWgmkXMpW
3sO1Ccebiye31wL+Pvd9EZh1nC4b3uMAZ7+onFRnTDe/h32xyN6tiqdPrwARAQAB
iQE8BBgBCAAmFiEEG/0j8D10J9kXmtqFbHCLBzit02oFAl4/AVQCGwwFCQPCZwAA
CgkQbHCLBzit02qi0wf+OikS4+uj+kDWPbtDK7zGwTgCprQFi2VICnD9SexkxPsA
iv20FT4VZuBfPeskopbLrQ43MNJizSnVoFfJY7EYN71/klw4RdgfZeix18Roe00U
kOXsFLHdV3mlfnTRRIlf+a3xJQsr/LF0CwfS/c9F+kMVLGHWhWzGzC8sM3QXZmoI
mNaopntVBzO1LavvfrtNDQ00NIzBdAXqY9ZnoT6RDnx410MoH5C6bqeB6sCREbI3
+O+TYkxG75JLU59v3vy20H7kzbqsFtxOXAtQZ0xSAygVV+zz2Onwe9NtGPx8vO/P
b8J5oyBs8n06/DGZpHTrSKYHDaoMHCVBq7fKzZaHJA==
=o637
-----END PGP PUBLIC KEY BLOCK-----
EOT;

        $bobPrivateKey = <<<EOT
-----BEGIN PGP PRIVATE KEY BLOCK-----

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
=LKzR
-----END PGP PRIVATE KEY BLOCK-----
EOT;

        $bobRevocationCertificate = <<<EOT
-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: This is a revocation certificate

iQE2BCABCAAgFiEEG/0j8D10J9kXmtqFbHCLBzit02oFAl4/AhoCHQAACgkQbHCL
Bzit02o+wgf9FmCElYVCEa+ZQNwMG+zHKJ6vGcafHhVbHSFcaMbePXFDHGtOLPgR
ZZwQ+ei5X7V0GZbaSv6HcoXAPhyOABpxiPi02o3MFj8EJzXNYgWQejSUwG9NuSGN
Uv1PGK9DQv+NW2JgButZM+jqpDODLd9BcHOyUFTQvZ7dgOv1qbshu+wnirOOx2ZI
lI4RdaastnV4I2jyG1PrO+BR4EuWzgXvdxp7YKUuOPaBXGbwX+2stghirfcuXG0z
TUbQy678I5T2bzjdENsusuoRfyS77gL0N4ISK1BvIWQjOz4n2q9JGLjUwsZ+mbqM
NkKEPMsXIdr9Fc9ctEs/iglo0tX+TDqnxw==
=b6TS
-----END PGP PUBLIC KEY BLOCK-----
EOT;

        $response = $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $options = [
                'json' => [
                    'email' => 'bob@crypter.com',
                    'name' => 'Bob',
                    'password' => 'password',
                    'public_key' => $bobPublicKey,
                    'private_key' => $bobPrivateKey,
                    'revocation_certificate' => $bobRevocationCertificate
                ]
            ],
            // $files = [],
            // $server = [
            //     'CONTENT_TYPE' => 'application/json'
            // ]
        );

        $bob = json_decode($response->getBody(), $assoc = true);


        $output->writeln('Populate Tester');

        $testerPublicKey = <<<EOT
-----BEGIN PGP PUBLIC KEY BLOCK-----

mQENBF4/Aq0BCACzg2TmAvzAlhtJvpD6Xhps4hu7RXF4H88DyN8jvab+GUHxQ2ux
bD5ihZQ+YJaFO8JK5g/rnganQ5iWHX5+6QVBdZ9SFH2D1zOJVTux5oGRn0eueKuv
VeqoQgKHjkLL1bnyZmkmRKvwj36pQlL0ujMihIzW8jHCChXlU1WQdqQN6P+6aP6I
oNcyDy3DysMAdesieGbW58P4T9lA7OlKTqOvZU1fT74SEaFW2nElAVeUDpA3PT/j
mYIkLVfepSAsC/KWdiH60eIQACCDd3z50ARgm8m7MmtZVuZscunhbqQ+42R4QKb/
72fZzUZ978ogV8EvJ+pv29KbsNAozGVi1uB/ABEBAAG0G1Rlc3RlciA8dGVzdGVy
QGNyeXB0ZXIuY29tPokBVAQTAQgAPhYhBLPOKoAH+rqMAdYVCK2GXVgtcdWmBQJe
PwKtAhsDBQkDwmcABQsJCAcCBhUKCQgLAgQWAgMBAh4BAheAAAoJEK2GXVgtcdWm
2P4H/1XoiSKyvL9Yub5GAYw91L4gLj+4fZ5ikjPlsIO9SDFCGvNpaH9th0dpCc+Q
Sfw+GdNM+bh944BLmUyOwNW4g/eJARHIo53ievX93GNXuclEybplceUTJdn7lKfg
kMI8ioIF7DnMxoaAV9zvwzbZhUu8BY3ryH7ZcurMx5gslEjLGTchljnBUitRuhVk
HniWkrFPW5IgMDqNBKAIWXGcGwtTidZldorCbIGjBCBMNkKoxQFCqueWGMs8yUDH
Wqm3NaFlm5LvAzqIjft/Vm5OmaLuxYsNpXUu+Sn4SvdNN64imZ7ki2Wbd5HwGaI2
CkRvffLDZoCHQtpLA28c5rjRnKK5AQ0EXj8CrQEIAL+jxiUEifwaKg8FX9fOaGct
GmmBF3Fw6/zar8npILtbv81umD7o5jJEXkgOPA8iGH0e6rgVLD/3cSxLlQmzUVZn
XrXmZ4lBrkkEwPjpHZxmXvOCbtf9uMB0ksllSAPm367NzEUh3Zu1/sYhNVX0RveX
tqT+o5OIwh68/OrJ//x5KrI+r/FJY8BWMi7pCj+xtkst7xQuCXuY+DzACTWlj5ng
ZWycYaIgE1Alv8SmlTtxqVkIIztfysO5w9T35OFW33g1lXVcp5k5o7mCslpDqViy
HgoXyYK2Jx48IJOQRyECGVFvvOmmDRWRdoo1Nz8XJQ9rTKuBY4evtN8VgrTMMOcA
EQEAAYkBPAQYAQgAJhYhBLPOKoAH+rqMAdYVCK2GXVgtcdWmBQJePwKtAhsMBQkD
wmcAAAoJEK2GXVgtcdWmOiUH/3UaX8CQprVNfE8k7CSztVP8W+GKL8MjHCgV6x9w
UCCvHAzGzfElhuOyJ692wjLdO2IO1P+N188HSJrYELCjRyvyYcj/Noiz+tuyIIAr
chx+DCx7kJIFDzWu1EDrTZuEk41RT4/BTLKjjMkRQvgJ/w9T2C5802lM7EXXxtjw
LvORypN4GcRWiaqMLG1INdSxkg9KwUzbzIVhEz0r1l2QFqgdXN68N5KE+0gMDF3L
QZC5G2Dj43RDJFmK+IAHqabDwCgROxh4vEGWTQyjtNN/RRe1iMbbZjoq4izO166o
LWww27CQ8TU057WUGGDvhwInZMgBprKz/WDlcacy5rMHUKk=
=H2U3
-----END PGP PUBLIC KEY BLOCK-----
EOT;

        $testerPrivateKey = <<<EOT
-----BEGIN PGP PRIVATE KEY BLOCK-----

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
=ILrw
-----END PGP PRIVATE KEY BLOCK-----
EOT;

        $testerRevocationCertificate = <<<EOT
-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: This is a revocation certificate

iQE2BCABCAAgFiEEs84qgAf6uowB1hUIrYZdWC1x1aYFAl4/DCMCHQAACgkQrYZd
WC1x1aZKGwf9Fz2hlE6PiyAhBxsJdIRp99OLgQobtisczw3N4uP6wFRSQR00n3Lx
U0rzy7xruiTR3BOYBiq2bO+g/iTFDCUI5aS5qUxwozxEN6VLpb3IMVY+XYSO38LF
YxJYmwmPB9b9wpRxYujKMSv20ACDiY/Jc5z9thTXGxSukDWkRZyhoIylFFIL/0+r
MRrdHndsfIkCSf5vuy7vNWLD6SGHr+vDYhX6w6j3O7QE5HdXPMXFUH/MEuu1yEFP
4i4rWsPrfnka7Ei1fHyMpy8/Mxlx0KhGiZctlby7ndybOq7zALjtpHA9QRCdrZq+
jRXCCvPi8WIs/BE8Iqcrix1+65JDnYqrtQ==
=HQAz
-----END PGP PUBLIC KEY BLOCK-----
EOT;

        $response = $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $options = [
                'headers' => [
                    'CONTENT_TYPE' => 'application/json'
                ],
                'json' => [
                    'email' => 'tester@crypter.com',
                    'name' => 'Tester',
                    'password' => 'password',
                    'public_key' => $testerPublicKey,
                    'private_key' => $testerPrivateKey,
                    'revocation_certificate' => $testerRevocationCertificate
                ]
            ],
            // $files = [],
            // $server = [
            //     'CONTENT_TYPE' => 'application/json'
            // ]
        );

        $tester = json_decode($response->getBody(), $assoc = true);


        $progress = new ProgressBar($output, $input->getOption('iterations') * 2);        
        $progress->start();


        $progress->setMessage('Message population\'s progress between Alice and Bob');

        $gpg = new \gnupg();

        $gpg->import($alicePublicKey);
        $gpg->import($bobPublicKey);

        $gpg->addencryptkey($gpg->keyinfo('Alice')[0]['subkeys'][0]['fingerprint']);
        $gpg->addencryptkey($gpg->keyinfo('Bobby')[0]['subkeys'][0]['fingerprint']);

        for ($i = 0; $i < $input->getOption('iterations'); $i++) {
            $client->request(
                $method = 'POST',
                $uri = "/api/messenger/message/{$bob['uuid']}",
                $options = [
                    'headers' => [
                        'Authorization' => "Bearer {$alice['jwt']}",
                        'CONTENT_TYPE' => 'application/json'
                    ],
                    'json' => [
                        'text' => $gpg->encrypt("{$i} Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.")
                    ]
                ],
                // $files = [],
                // $server = [
                //     'HTTP_AUTHORIZATION' => "Bearer {$alice['jwt']}",
                //     'CONTENT_TYPE' => 'application/json'
                // ]
            );

            $progress->advance();            
        }


        $progress->setMessage('Message population\'s progress between Bob and Tester');

        $gpg = new \gnupg();

        $gpg->import($bobPublicKey);
        $gpg->import($testerPublicKey);

        $gpg->addencryptkey($gpg->keyinfo('Bobby')[0]['subkeys'][0]['fingerprint']);
        $gpg->addencryptkey($gpg->keyinfo('Tester')[0]['subkeys'][0]['fingerprint']);

        for ($i = 0; $i < $input->getOption('iterations'); $i++) {
            $client->request(
                $method = 'POST',
                $uri = "/api/messenger/message/{$bob['uuid']}",
                $options = [
                    'headers' => [
                        'Authorization' => "Bearer {$tester['jwt']}",
                        'CONTENT_TYPE' => 'application/json'
                    ],
                    'json' => [
                        'text' => $gpg->encrypt("{$i} Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.")
                    ]
                ],
                // $files = [],
                // $server = [
                //     'HTTP_AUTHORIZATION' => "Bearer {$tester['jwt']}",
                //     'CONTENT_TYPE' => 'application/json'
                // ]
            );

            $progress->advance();
        }


        $progress->finish();

        $output->writeln('');
    }
}
